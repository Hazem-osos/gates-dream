/**
 * On-prem first-run setup, driven by the launcher (GatesERP.exe). Never used on the SaaS deployment.
 *
 *   node onprem-setup.js status         → schema state + user count
 *   node onprem-setup.js init-schema    → build every table on an EMPTY database
 *   node onprem-setup.js create-admin   → first company + admin (JSON on stdin), only when no users exist
 *
 * The result is printed as one line "@@GATES_RESULT@@{json}" because the app logger also writes
 * to stdout.
 *
 * Why init-schema does not run `prisma migrate deploy`: the historical migration chain cannot
 * build an empty database (docs/migration/PRISMA_FRESH_INSTALL_BASELINE.md). Instead the build
 * ships bootstrap/baseline.sql — the full current schema from `prisma migrate diff --from-empty`
 * — and, once it is applied, records every shipped migration as applied with Prisma's own
 * checksum. That is the procedure the doc describes for a NEW, EMPTY database, and the command
 * refuses to touch a database that already has any table.
 */
import 'dotenv/config';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import prisma from '../shared/database/prisma';
import { activateOnPremLicense } from '../shared/onprem-license/onprem-license';
import { createCompanyWithAdmin } from '../modules/platform-admin/services/platform-companies.service';

const RESULT_MARK = '@@GATES_RESULT@@';

async function tableNames(): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()`;
  return rows.map((r) => r.name);
}

async function status() {
  const tables = await tableNames();
  if (tables.length === 0) return { ok: true, schema: 'empty', users: 0 };
  if (!tables.includes('_prisma_migrations') || !tables.includes('users')) {
    return { ok: true, schema: 'other', tables: tables.length, users: 0 };
  }
  const users = await prisma.user.count();
  return { ok: true, schema: 'gates', users };
}

function splitSql(sql: string): string[] {
  const withoutComments = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  return withoutComments
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const PRISMA_MIGRATIONS_TABLE = `CREATE TABLE IF NOT EXISTS \`_prisma_migrations\` (
    \`id\`                    VARCHAR(36) PRIMARY KEY NOT NULL,
    \`checksum\`              VARCHAR(64) NOT NULL,
    \`finished_at\`           DATETIME(3),
    \`migration_name\`        VARCHAR(255) NOT NULL,
    \`logs\`                  TEXT,
    \`rolled_back_at\`        DATETIME(3),
    \`started_at\`            DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`applied_steps_count\`   INTEGER UNSIGNED NOT NULL DEFAULT 0
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;

async function initSchema() {
  const tables = await tableNames();
  if (tables.length > 0) {
    return { ok: false, message: `قاعدة البيانات ليست فارغة (${tables.length} جدول). استخدم قاعدة بيانات جديدة فارغة.` };
  }
  const root = process.cwd();
  const baselinePath = path.join(root, 'bootstrap', 'baseline.sql');
  const migrationsDir = path.join(root, 'prisma', 'migrations');
  if (!existsSync(baselinePath) || !existsSync(migrationsDir)) {
    return { ok: false, message: 'ملفات إنشاء قاعدة البيانات غير موجودة في البرنامج (bootstrap/baseline.sql).' };
  }

  const statements = splitSql(readFileSync(baselinePath, 'utf8'));
  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }

  await prisma.$executeRawUnsafe(PRISMA_MIGRATIONS_TABLE);
  const names = readdirSync(migrationsDir)
    .filter((n) => statSync(path.join(migrationsDir, n)).isDirectory())
    .filter((n) => existsSync(path.join(migrationsDir, n, 'migration.sql')))
    .sort();
  for (const name of names) {
    const checksum = createHash('sha256')
      .update(readFileSync(path.join(migrationsDir, name, 'migration.sql')))
      .digest('hex');
    await prisma.$executeRaw`
      INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
      VALUES (${randomUUID()}, ${checksum}, NOW(3), ${name}, NULL, NULL, NOW(3), 1)`;
  }
  return { ok: true, statements: statements.length, migrationsRecorded: names.length };
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

async function createAdmin() {
  const s = await status();
  if (s.schema !== 'gates') return { ok: false, message: 'أنشئ جداول قاعدة البيانات أولاً.' };
  if (s.users > 0) return { ok: false, message: 'يوجد مستخدمون بالفعل؛ لا يمكن إنشاء مدير أول مرة أخرى.' };

  const input = JSON.parse(await readStdin()) as {
    companyName: string;
    email: string;
    username: string;
    password: string;
  };
  if (!input.companyName?.trim() || !input.email?.trim() || !input.username?.trim() || (input.password ?? '').length < 8) {
    return { ok: false, message: 'بيانات ناقصة: اسم الشركة، البريد، اسم المستخدم، وكلمة مرور 8 أحرف على الأقل.' };
  }
  const result = await createCompanyWithAdmin({
    arabicName: input.companyName.trim(),
    admin: { email: input.email.trim().toLowerCase(), username: input.username.trim(), password: input.password },
  });
  return { ok: true, companyId: result.company.id, admin: input.username.trim() };
}

async function run(command: string | undefined): Promise<Record<string, unknown>> {
  // License first: setup on an unlicensed machine is refused like everything else.
  activateOnPremLicense();
  if (command === 'status') return status();
  if (command === 'init-schema') return initSchema();
  if (command === 'create-admin') return createAdmin();
  return { ok: false, message: 'usage: onprem-setup status | init-schema | create-admin' };
}

async function main() {
  let result: Record<string, unknown>;
  try {
    result = await run(process.argv[2]);
  } catch (error) {
    result = { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
  process.stdout.write(`\n${RESULT_MARK}${JSON.stringify(result)}\n`);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(result.ok ? 0 : 1);
}

void main();
