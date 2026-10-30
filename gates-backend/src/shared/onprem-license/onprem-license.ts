/**
 * On-prem (exe) license enforcement. Does nothing at all outside an on-prem install, so the
 * Railway/SaaS deployment is unaffected.
 *
 * On-prem mode is ON when either:
 *   - the backend was built by scripts/onprem/build-onprem.mjs, which compiles the constant
 *     __GATES_ONPREM_BUILD__ = true into the bundle (the shipped exe — no env var can turn it off), or
 *   - GATES_ONPREM=1 is set (developer testing of the flow; it can only switch licensing on).
 *
 * What is enforced:
 *   1. Boot: a valid license for THIS machine must exist, or the server refuses to start.
 *   2. Hourly: the license is re-checked (expiry); on failure the server shuts down.
 *   3. Adding / re-enabling a user: active users across the whole installation ≤ maxUsers.
 *   4. Login: refused while active users exceed maxUsers (e.g. rows inserted straight into
 *      the customer's database), so the limit cannot be side-stepped outside the API.
 */
import prisma from '../database/prisma';
import { AppError } from '../middleware/error-handler';
import { LICENSE_FAILURE_MESSAGES, type OnPremLicensePayload } from './license-codec';
import { checkLicenseFile, licenseFilePath } from './license-file';

declare const __GATES_ONPREM_BUILD__: boolean | undefined;

export function isOnPremMode(): boolean {
  const built = typeof __GATES_ONPREM_BUILD__ !== 'undefined' && __GATES_ONPREM_BUILD__ === true;
  return built || process.env.GATES_ONPREM === '1';
}

let current: OnPremLicensePayload | null = null;

/** Boot gate. Throws (with an Arabic message) when the license is missing or invalid. */
export function activateOnPremLicense(): OnPremLicensePayload {
  const result = checkLicenseFile();
  if (!result.ok) {
    current = null;
    throw new Error(
      `${LICENSE_FAILURE_MESSAGES[result.reason]} (كود الجهاز: ${result.machineId} — ملف الترخيص: ${licenseFilePath()})`
    );
  }
  current = result.license;
  return result.license;
}

function requireLicense(): OnPremLicensePayload {
  if (!current) {
    throw new AppError(403, 'البرنامج غير مرخص على هذا الجهاز.');
  }
  if (current.expiresAt !== null && Date.now() > Date.parse(current.expiresAt)) {
    throw new AppError(403, LICENSE_FAILURE_MESSAGES.EXPIRED);
  }
  return current;
}

async function countActiveUsers(): Promise<number> {
  // Whole installation, every company: the license is per server, not per company.
  return prisma.user.count({ where: { isActive: true } });
}

/** Called before a user is created or re-enabled. No-op outside on-prem mode. */
export async function assertOnPremUserSeat(adding = 1): Promise<void> {
  if (!isOnPremMode()) return;
  const license = requireLicense();
  const used = await countActiveUsers();
  if (used + adding > license.maxUsers) {
    throw new AppError(
      403,
      `وصلت لعدد المستخدمين المسموح به في الترخيص (${license.maxUsers}). أوقف مستخدماً أو تواصل مع Gates لزيادة العدد.`
    );
  }
}

/**
 * Called on every login. No-op outside on-prem mode.
 * When active users exceed the limit (rows added outside the API, or a race between two
 * simultaneous creates) only the OLDEST `maxUsers` active users may log in — so the
 * original admin can still get in and deactivate the extras.
 */
export async function assertOnPremLoginAllowed(userId: string): Promise<void> {
  if (!isOnPremMode()) return;
  const license = requireLicense();
  const used = await countActiveUsers();
  if (used <= license.maxUsers) return;
  const allowed = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: license.maxUsers,
    select: { id: true },
  });
  if (!allowed.some((u) => u.id === userId)) {
    throw new AppError(
      403,
      `عدد المستخدمين النشطين (${used}) أكبر من المسموح في الترخيص (${license.maxUsers}). يجب على مدير النظام إيقاف بعض المستخدمين أو التواصل مع Gates.`
    );
  }
}

/** Public summary for an "about / license" screen. Never includes the raw license text. */
export function getOnPremLicenseSummary() {
  if (!isOnPremMode()) return { onPrem: false as const };
  return {
    onPrem: true as const,
    licensed: current !== null,
    customer: current?.customer ?? null,
    licenseId: current?.licenseId ?? null,
    maxUsers: current?.maxUsers ?? null,
    expiresAt: current?.expiresAt ?? null,
  };
}

/** Test hook. */
export function __setOnPremLicenseForTests(license: OnPremLicensePayload | null): void {
  current = license;
}
