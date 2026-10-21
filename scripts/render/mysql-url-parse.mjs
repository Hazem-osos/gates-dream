/** Parse mysql:// URL for shell scripts (stdout: host port user password database). */
const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error('DATABASE_URL missing');
  process.exit(1);
}
let parsed;
try {
  parsed = new URL(url);
} catch {
  console.error('Invalid DATABASE_URL');
  process.exit(1);
}
if (parsed.protocol !== 'mysql:') {
  console.error('Expected mysql:// URL');
  process.exit(1);
}
const host = parsed.hostname;
const port = parsed.port || '3306';
const user = decodeURIComponent(parsed.username);
const password = decodeURIComponent(parsed.password);
const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
if (!host || !user || !database) {
  console.error('DATABASE_URL missing host, user, or database');
  process.exit(1);
}
process.stdout.write(
  JSON.stringify({ host, port, user, password, database })
);
