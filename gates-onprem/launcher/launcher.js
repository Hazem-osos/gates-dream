'use strict';
/**
 * GatesERP.exe — on-prem launcher (packaged with @yao-pkg/pkg; plain CommonJS, no dependencies).
 *
 * Folder layout next to the exe:
 *   GatesERP.exe
 *   gates.lic                 ← license file from Gates (machine-locked)
 *   runtime/node.exe          ← official Node.js runtime
 *   app/backend/              ← API (license enforced inside, independent of this launcher)
 *   app/web/                  ← Next.js web app
 *   data/config.dat           ← DB connection + secrets, encrypted with a key tied to this machine
 *   data/logs/                ← backend.log, web.log
 *
 *   GatesERP.exe                 start (first run: license → DB connection → tables → first admin)
 *   GatesERP.exe --machine-code  print this machine's code
 *   GatesERP.exe --change-db     enter a new database connection string
 *
 * The launcher only makes setup friendly. Licensing is enforced by the backend itself
 * (boot check, hourly re-check, user limit), so running the app without the launcher does not
 * skip the license.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const readline = require('readline');
const { spawn, spawnSync } = require('child_process');

const VERSION = '1.0.0';
const IS_WIN = process.platform === 'win32';
const BASE = process.env.GATES_HOME
  ? path.resolve(process.env.GATES_HOME)
  : process.pkg
    ? path.dirname(process.execPath)
    : process.cwd();
const NODE = IS_WIN ? path.join(BASE, 'runtime', 'node.exe') : process.env.GATES_NODE || process.execPath;
const BACKEND = path.join(BASE, 'app', 'backend');
const WEB = path.join(BASE, 'app', 'web');
const DATA = path.join(BASE, 'data');
const LOGS = path.join(DATA, 'logs');
const LICENSE_FILE = path.join(BASE, 'gates.lic');
const CONFIG_FILE = path.join(DATA, 'config.dat');
const RESULT_MARK = '@@GATES_RESULT@@';

// ───────────────────────── console helpers ─────────────────────────

function line(text = '') {
  process.stdout.write(`${text}\n`);
}

function box(title, lines) {
  line('');
  line('='.repeat(64));
  line(`  ${title}`);
  line('-'.repeat(64));
  for (const l of lines) line(`  ${l}`);
  line('='.repeat(64));
  line('');
}

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (s) => {
        if (s.includes(question)) rl.output.write(s);
        else if (s === '\r\n' || s === '\n' || s === '\r') rl.output.write(s);
        else rl.output.write('*');
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) line('');
      resolve(answer.trim());
    });
  });
}

async function pauseAndExit(code) {
  await ask('Press Enter to close / اضغط Enter للإغلاق ');
  process.exit(code);
}

// ───────────────────────── backend helpers ─────────────────────────

function runNode(script, args, { cwd, env, input } = {}) {
  const r = spawnSync(NODE, [script, ...args], {
    cwd,
    env,
    input,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 15 * 60 * 1000,
  });
  return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '', error: r.error };
}

function lastJsonLine(text) {
  const lines = text.trim().split(/\r?\n/).reverse();
  for (const l of lines) {
    try {
      return JSON.parse(l);
    } catch {
      /* keep looking */
    }
  }
  return null;
}

function licenseCli(command) {
  const r = runNode(path.join(BACKEND, 'license-cli.js'), [command], {
    cwd: BACKEND,
    env: { ...process.env, GATES_LICENSE_FILE: LICENSE_FILE },
  });
  return lastJsonLine(r.stdout) || { ok: false, message: (r.error && r.error.message) || r.stderr.slice(-500) };
}

function setupCmd(command, env, input) {
  const r = runNode(path.join(BACKEND, 'onprem-setup.js'), [command], { cwd: BACKEND, env, input });
  const at = r.stdout.lastIndexOf(RESULT_MARK);
  if (at === -1) {
    return { ok: false, message: (r.error && r.error.message) || (r.stderr || r.stdout).slice(-1500) };
  }
  return JSON.parse(r.stdout.slice(at + RESULT_MARK.length).split(/\r?\n/)[0]);
}

// ───────────────────────── encrypted config ─────────────────────────
// Key derived from the machine code: a config.dat copied to another machine cannot be read there.

function configKey(machineId) {
  return crypto.createHash('sha256').update(`gates-onprem-config-v1|${machineId}`).digest();
}

function saveConfig(cfg, machineId) {
  fs.mkdirSync(DATA, { recursive: true });
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', configKey(machineId), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(cfg), 'utf8'), cipher.final()]);
  const out = { v: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(out));
}

function loadConfig(machineId) {
  if (!fs.existsSync(CONFIG_FILE)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', configKey(machineId), Buffer.from(raw.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(raw.tag, 'base64'));
    const text = Buffer.concat([decipher.update(Buffer.from(raw.data, 'base64')), decipher.final()]).toString('utf8');
    return JSON.parse(text);
  } catch {
    return 'UNREADABLE';
  }
}

function parseDbUrl(text) {
  let u;
  try {
    u = new URL(text);
  } catch {
    return { error: 'Not a valid URL / الرابط غير صحيح' };
  }
  if (u.protocol !== 'mysql:') return { error: 'Must start with mysql:// / يجب أن يبدأ بـ mysql://' };
  if (!u.hostname || !u.pathname || u.pathname === '/') return { error: 'Host and database name are required / يلزم اسم السيرفر وقاعدة البيانات' };
  // Never let an on-prem install point at Gates' own cloud database.
  if (/railway\.app|rlwy\.net|railway\.internal/i.test(u.hostname)) {
    return { error: 'This host is not allowed / هذا السيرفر غير مسموح' };
  }
  return { url: u.toString() };
}

async function promptDbUrl() {
  box('Database connection / الاتصال بقاعدة البيانات', [
    'Enter the MySQL connection string for this customer:',
    'أدخل رابط الاتصال بقاعدة بيانات MySQL الخاصة بالعميل:',
    '',
    '  mysql://USER:PASSWORD@HOST:3306/DATABASE',
    '',
    'Special characters in the password must be URL-encoded (@ → %40).',
    'Use a NEW, EMPTY database for a first install.',
    'استخدم قاعدة بيانات جديدة فارغة في أول تثبيت.',
  ]);
  for (;;) {
    const answer = await ask('Connection string: ', { hidden: true });
    const parsed = parseDbUrl(answer);
    if (parsed.url) return parsed.url;
    line(`  ✖ ${parsed.error}`);
  }
}

// ───────────────────────── network helpers ─────────────────────────

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  }
  return out;
}

function waitForHttp(url, timeoutMs, child) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    const tick = () => {
      if (child.exitCode !== null) return resolve(false);
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) return resolve(true);
        retry();
      });
      req.on('error', retry);
      req.setTimeout(3000, () => req.destroy());
    };
    const retry = () => (Date.now() > deadline ? resolve(false) : setTimeout(tick, 1000));
    tick();
  });
}

function tail(file, n = 30) {
  try {
    return fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).slice(-n);
  } catch {
    return [];
  }
}

function startChild(name, script, cwd, env) {
  fs.mkdirSync(LOGS, { recursive: true });
  const logFile = path.join(LOGS, `${name}.log`);
  const fd = fs.openSync(logFile, 'a');
  fs.writeSync(fd, `\n===== ${new Date().toISOString()} start ${name} =====\n`);
  const child = spawn(NODE, [script], { cwd, env, stdio: ['ignore', fd, fd], windowsHide: true });
  child.logFile = logFile;
  return child;
}

// ───────────────────────── main flow ─────────────────────────

async function main() {
  if (IS_WIN) spawnSync('cmd', ['/c', 'chcp 65001 >nul'], { stdio: 'inherit' });
  line(`Gates ERP — on-premise server v${VERSION}`);

  if (!fs.existsSync(NODE) || !fs.existsSync(path.join(BACKEND, 'license-cli.js'))) {
    box('Installation incomplete / التثبيت غير مكتمل', [`Missing files under ${BASE}`, 'أعد نسخ مجلد البرنامج كاملاً.']);
    return pauseAndExit(1);
  }

  // 1) Machine code
  const mid = licenseCli('machine-id');
  if (!mid.machineId) {
    box('Cannot read machine code / تعذر قراءة كود الجهاز', [String(mid.message || '')]);
    return pauseAndExit(1);
  }
  const machineId = mid.machineId;
  try {
    fs.writeFileSync(path.join(BASE, 'machine-code.txt'), `${machineId}\n`);
  } catch {
    /* read-only folder: the code is still printed below */
  }
  if (process.argv.includes('--machine-code')) {
    line(machineId);
    return;
  }

  // 2) License
  const lic = licenseCli('check');
  if (!lic.ok) {
    box('License required / مطلوب ترخيص', [
      `Machine code / كود الجهاز:   ${machineId}`,
      '',
      String(lic.message || ''),
      '',
      'Send this machine code to Gates. Put the license file you receive',
      `next to GatesERP.exe as:  ${LICENSE_FILE}`,
      'أرسل كود الجهاز إلى Gates، وضع ملف الترخيص gates.lic بجوار البرنامج.',
      '(The code is also saved in machine-code.txt)',
    ]);
    return pauseAndExit(1);
  }
  line(`License: ${lic.customer} — up to ${lic.maxUsers} users — ${lic.expiresAt ? `valid until ${lic.expiresAt.slice(0, 10)}` : 'permanent'}`);

  // 3) Config (DB connection + secrets)
  let cfg = loadConfig(machineId);
  if (cfg === 'UNREADABLE') {
    line('  ! Saved settings belong to another machine or are damaged — please enter them again.');
    cfg = null;
  }
  if (!cfg || process.argv.includes('--change-db')) {
    const databaseUrl = await promptDbUrl();
    cfg = {
      databaseUrl,
      webPort: (cfg && cfg.webPort) || 3000,
      apiPort: (cfg && cfg.apiPort) || 3001,
      jwtSecret: (cfg && cfg.jwtSecret) || crypto.randomBytes(48).toString('hex'),
      encryptionKey: (cfg && cfg.encryptionKey) || crypto.randomBytes(32).toString('hex'),
    };
    saveConfig(cfg, machineId);
    line('  ✔ Settings saved (encrypted for this machine).');
  }

  const host = os.hostname().toLowerCase();
  const webOrigins = [host, 'localhost', '127.0.0.1', ...lanAddresses()].map((h) => `http://${h}:${cfg.webPort}`);
  const backendEnv = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(cfg.apiPort),
    DATABASE_URL: cfg.databaseUrl,
    JWT_DEV_SECRET: cfg.jwtSecret,
    ENCRYPTION_KEY: cfg.encryptionKey,
    KEYCLOAK_ENABLED: 'false',
    API_AUTH_MODE: 'enforce',
    REDIS_ENABLED: 'false',
    MQTT_ENABLED: 'false',
    FRONTEND_URL: `http://${host}:${cfg.webPort}`,
    CORS_ORIGINS: webOrigins.join(','),
    GATES_LICENSE_FILE: LICENSE_FILE,
  };

  // 4) Database: tables + first admin
  let st = setupCmd('status', backendEnv);
  if (!st.ok) {
    box('Cannot connect to the database / تعذر الاتصال بقاعدة البيانات', [
      String(st.message || '').slice(0, 600),
      '',
      'Run "GatesERP.exe --change-db" to enter a new connection string.',
    ]);
    return pauseAndExit(1);
  }
  if (st.schema === 'other') {
    box('Database is not empty / قاعدة البيانات ليست فارغة', [
      'It contains tables that are not a Gates database.',
      'Use a new, empty database. / استخدم قاعدة بيانات جديدة فارغة.',
    ]);
    return pauseAndExit(1);
  }
  if (st.schema === 'empty') {
    line('Creating database tables (first install, can take a few minutes)...');
    line('جارٍ إنشاء جداول قاعدة البيانات...');
    const r = setupCmd('init-schema', backendEnv);
    if (!r.ok) {
      box('Database setup failed / فشل إنشاء قاعدة البيانات', [String(r.message || '').slice(0, 800)]);
      return pauseAndExit(1);
    }
    line(`  ✔ Tables created (${r.statements} statements).`);
    st = setupCmd('status', backendEnv);
  }
  if (st.users === 0) {
    box('First administrator / مدير النظام الأول', ['Create the company and the admin account.', 'أنشئ الشركة وحساب المدير.']);
    const companyName = await ask('Company name / اسم الشركة: ');
    const email = await ask('Admin email / بريد المدير: ');
    const username = await ask('Admin username / اسم المستخدم: ');
    let password = '';
    for (;;) {
      password = await ask('Password (8+ chars) / كلمة المرور: ', { hidden: true });
      const again = await ask('Repeat password / أعد كلمة المرور: ', { hidden: true });
      if (password.length >= 8 && password === again) break;
      line('  ✖ Passwords must match and be at least 8 characters.');
    }
    const r = setupCmd('create-admin', backendEnv, JSON.stringify({ companyName, email, username, password }));
    if (!r.ok) {
      box('Could not create the admin / تعذر إنشاء المدير', [String(r.message || '').slice(0, 800)]);
      return pauseAndExit(1);
    }
    line(`  ✔ Company and admin "${r.admin}" created.`);
  }

  // 5) Start API + web
  line('Starting Gates ERP... / جارٍ التشغيل...');
  const api = startChild('backend', path.join(BACKEND, 'index.js'), BACKEND, backendEnv);
  if (!(await waitForHttp(`http://127.0.0.1:${cfg.apiPort}/health/live`, 180_000, api))) {
    box('The server did not start / لم يبدأ السيرفر', [...tail(api.logFile, 25), '', `Full log: ${api.logFile}`]);
    try { api.kill(); } catch { /* already gone */ }
    return pauseAndExit(1);
  }
  const web = startChild('web', path.join(WEB, 'server.js'), WEB, {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(cfg.webPort),
    HOSTNAME: '0.0.0.0',
    BACKEND_INTERNAL_URL: `http://127.0.0.1:${cfg.apiPort}`,
    NEXT_TELEMETRY_DISABLED: '1',
  });
  if (!(await waitForHttp(`http://127.0.0.1:${cfg.webPort}/health`, 120_000, web))) {
    box('The web app did not start / لم تبدأ الواجهة', [...tail(web.logFile, 25), '', `Full log: ${web.logFile}`]);
    try { api.kill(); web.kill(); } catch { /* ignore */ }
    return pauseAndExit(1);
  }

  box('Gates ERP is running / البرنامج يعمل', [
    `On this server:      http://localhost:${cfg.webPort}`,
    ...[host, ...lanAddresses()].map((h) => `From other devices:  http://${h}:${cfg.webPort}`),
    '',
    'Keep this window open. Closing it stops the program.',
    'اترك هذه النافذة مفتوحة؛ إغلاقها يوقف البرنامج.',
  ]);
  if (IS_WIN) spawn('cmd', ['/c', 'start', '', `http://localhost:${cfg.webPort}`], { stdio: 'ignore', detached: true }).unref();

  const stopAll = (code) => {
    for (const c of [api, web]) {
      try { if (c.exitCode === null) c.kill(); } catch { /* ignore */ }
    }
    setTimeout(() => process.exit(code), 1500);
  };
  api.on('exit', (code) => {
    box('The server stopped / توقف السيرفر', [`exit code ${code}`, ...tail(api.logFile, 15)]);
    stopAll(1);
  });
  web.on('exit', (code) => {
    box('The web app stopped / توقفت الواجهة', [`exit code ${code}`, ...tail(web.logFile, 15)]);
    stopAll(1);
  });
  // Ctrl+C, service stop, and closing the console window (SIGHUP on Windows) all stop both servers.
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => stopAll(0));
}

main().catch(async (error) => {
  box('Unexpected error / خطأ غير متوقع', [String((error && error.stack) || error)]);
  await pauseAndExit(1);
});
