/**
 * Creates (or resets the password of) a platform admin for the /admin panel.
 *
 * Credentials come from the environment so they never land in this public repository:
 *
 *   PLATFORM_ADMIN_EMAIL=... PLATFORM_ADMIN_PASSWORD=... npx tsx scripts/create-platform-admin.ts
 *
 * Writes one row to `platform_admins` in the database DATABASE_URL points at. A non-local
 * database additionally requires --confirm-remote, so it cannot happen by accident.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import prisma from '../src/shared/database/prisma';

function dbHost(url: string | undefined): string {
  try {
    return new URL(url ?? '').hostname;
  } catch {
    return '';
  }
}

async function main(): Promise<void> {
  const email = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.PLATFORM_ADMIN_PASSWORD ?? '';
  const name = process.env.PLATFORM_ADMIN_NAME?.trim() || null;
  if (!email || !email.includes('@')) throw new Error('Set PLATFORM_ADMIN_EMAIL');
  if (password.length < 6) throw new Error('Set PLATFORM_ADMIN_PASSWORD (6+ characters)');

  const host = dbHost(process.env.DATABASE_URL);
  const local = ['127.0.0.1', 'localhost', '::1'].includes(host);
  if (!local && !process.argv.includes('--confirm-remote')) {
    throw new Error(`DATABASE_URL points at "${host}", not a local database. Re-run with --confirm-remote if intended.`);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.platformAdmin.upsert({
    where: { email },
    create: { email, passwordHash, name },
    update: { passwordHash, isActive: true, ...(name ? { name } : {}) },
    select: { id: true, email: true },
  });
  console.log(`Platform admin ready: ${admin.email} (${admin.id}) on ${host}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    // The shared app modules keep timers/connections open; without this the script never exits.
    process.exit(process.exitCode ?? 0);
  });
