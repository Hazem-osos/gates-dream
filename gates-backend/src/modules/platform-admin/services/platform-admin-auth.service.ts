import bcrypt from 'bcryptjs';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { signPlatformAdminToken } from '../platform-admin-token';
import { capsForRole, type PlatformAdminRole } from '../platform-admin-roles';
import {
  decryptSecret,
  encryptSecret,
  generateTotpSecret,
  totpUri,
  verifyTotp,
} from '../totp';

// Same idea as the tenant login: always run a bcrypt compare so timing does not reveal emails.
const DUMMY_HASH = '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234';

const adminSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  totpEnabledAt: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

type AdminRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  totpEnabledAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
};

function present(a: AdminRow) {
  const { totpEnabledAt, ...rest } = a;
  return { ...rest, twoFactorEnabled: Boolean(totpEnabledAt) };
}

export function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function adminProfile(a: { id: string; email: string; name: string | null; role: string; totpEnabledAt?: Date | null }) {
  return {
    id: a.id,
    email: a.email,
    name: a.name,
    role: a.role,
    caps: capsForRole(a.role),
    twoFactorEnabled: Boolean(a.totpEnabledAt),
  };
}

export async function loginPlatformAdmin(email: string, password: string, code?: string) {
  const admin = await prisma.platformAdmin.findUnique({
    where: { email: normalizeAdminEmail(email) },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      passwordHash: true,
      isActive: true,
      totpSecretEnc: true,
      totpEnabledAt: true,
      totpLastStep: true,
      sessionVersion: true,
    },
  });
  const ok = await bcrypt.compare(password, admin?.passwordHash ?? DUMMY_HASH);
  if (!admin || !ok || !admin.isActive) {
    throw new AppError(401, 'البريد الإلكتروني أو كلمة المرور غير صحيحة');
  }

  if (admin.totpEnabledAt && admin.totpSecretEnc) {
    if (!code) {
      throw new AppError(401, 'أدخل رمز التحقق من تطبيق المصادقة', true, 'TOTP_REQUIRED');
    }
    const step = verifyTotp(decryptSecret(admin.totpSecretEnc), code, admin.totpLastStep);
    if (step === null) throw new AppError(401, 'رمز التحقق غير صحيح أو مستخدم من قبل', true, 'TOTP_INVALID');
    // Conditional write: two concurrent logins with the same code cannot both pass.
    const claimed = await prisma.platformAdmin.updateMany({
      where: { id: admin.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
      data: { totpLastStep: step, lastLoginAt: new Date() },
    });
    if (claimed.count !== 1) throw new AppError(401, 'رمز التحقق مستخدم من قبل', true, 'TOTP_INVALID');
  } else {
    await prisma.platformAdmin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  }

  const token = signPlatformAdminToken(admin);
  return { ...token, admin: adminProfile(admin) };
}

export async function listPlatformAdmins() {
  const rows = await prisma.platformAdmin.findMany({ orderBy: { createdAt: 'asc' }, select: adminSelect });
  return rows.map(present);
}

export async function createPlatformAdmin(input: {
  email: string;
  password: string;
  name?: string | null;
  role?: PlatformAdminRole;
}) {
  const email = normalizeAdminEmail(input.email);
  const exists = await prisma.platformAdmin.findUnique({ where: { email }, select: { id: true } });
  if (exists) throw new AppError(409, 'يوجد مدير منصة بهذا البريد بالفعل');
  const row = await prisma.platformAdmin.create({
    data: {
      email,
      name: input.name ?? null,
      role: input.role ?? 'VIEWER',
      passwordHash: await bcrypt.hash(input.password, 12),
    },
    select: adminSelect,
  });
  return present(row);
}

async function assertAnotherActiveOwner(adminId: string): Promise<void> {
  const others = await prisma.platformAdmin.count({
    where: { isActive: true, role: 'OWNER', id: { not: adminId } },
  });
  if (others === 0) throw new AppError(400, 'يجب أن يبقى مالك منصة واحد مفعّل على الأقل');
}

export async function updatePlatformAdmin(
  actorId: string,
  adminId: string,
  data: { isActive?: boolean; role?: PlatformAdminRole; resetTwoFactor?: boolean }
) {
  const target = await prisma.platformAdmin.findUnique({ where: { id: adminId }, select: { role: true, isActive: true } });
  if (!target) throw new AppError(404, 'مدير المنصة غير موجود');
  if (actorId === adminId && (data.isActive === false || (data.role && data.role !== target.role))) {
    throw new AppError(400, 'لا يمكنك إيقاف حسابك أو تغيير دورك بنفسك');
  }
  const losesOwner =
    target.role === 'OWNER' && target.isActive && (data.isActive === false || (data.role && data.role !== 'OWNER'));
  if (losesOwner) await assertAnotherActiveOwner(adminId);

  const row = await prisma.platformAdmin.update({
    where: { id: adminId },
    data: {
      ...(typeof data.isActive === 'boolean' ? { isActive: data.isActive } : {}),
      ...(data.role ? { role: data.role } : {}),
      ...(data.resetTwoFactor ? { totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null } : {}),
      // Any of these ends the admin's open sessions.
      sessionVersion: { increment: 1 },
    },
    select: adminSelect,
  });
  return present(row);
}

/** Returns a fresh token so the admin who changed the password stays signed in. */
export async function changePlatformAdminPassword(adminId: string, currentPassword: string, newPassword: string) {
  const admin = await prisma.platformAdmin.findUnique({ where: { id: adminId }, select: { passwordHash: true } });
  if (!admin || !(await bcrypt.compare(currentPassword, admin.passwordHash))) {
    throw new AppError(400, 'كلمة المرور الحالية غير صحيحة');
  }
  const updated = await prisma.platformAdmin.update({
    where: { id: adminId },
    data: { passwordHash: await bcrypt.hash(newPassword, 12), sessionVersion: { increment: 1 } },
    select: { id: true, email: true, sessionVersion: true },
  });
  return signPlatformAdminToken(updated);
}

/** Step 1: create a pending secret. 2FA is not required until the admin confirms a code. */
export async function startTwoFactorSetup(adminId: string) {
  const admin = await prisma.platformAdmin.findUnique({ where: { id: adminId }, select: { email: true, totpEnabledAt: true } });
  if (!admin) throw new AppError(404, 'مدير المنصة غير موجود');
  if (admin.totpEnabledAt) throw new AppError(409, 'التحقق الثنائي مفعّل بالفعل. أوقفه أولاً لإعادة الإعداد.');
  const secret = generateTotpSecret();
  await prisma.platformAdmin.update({
    where: { id: adminId },
    data: { totpSecretEnc: encryptSecret(secret), totpLastStep: null },
  });
  return { secret, otpauthUrl: totpUri(secret, admin.email) };
}

/** Step 2: a valid code turns 2FA on and ends other sessions; returns a fresh token. */
export async function confirmTwoFactor(adminId: string, code: string) {
  const admin = await prisma.platformAdmin.findUnique({
    where: { id: adminId },
    select: { totpSecretEnc: true, totpEnabledAt: true },
  });
  if (!admin?.totpSecretEnc || admin.totpEnabledAt) throw new AppError(400, 'ابدأ إعداد التحقق الثنائي أولاً');
  const step = verifyTotp(decryptSecret(admin.totpSecretEnc), code, null);
  if (step === null) throw new AppError(400, 'الرمز غير صحيح. تأكد من وقت الهاتف وأعد المحاولة.');
  const updated = await prisma.platformAdmin.update({
    where: { id: adminId },
    data: { totpEnabledAt: new Date(), totpLastStep: step, sessionVersion: { increment: 1 } },
    select: { id: true, email: true, sessionVersion: true },
  });
  return signPlatformAdminToken(updated);
}

export async function disableTwoFactor(adminId: string, password: string, code: string) {
  const admin = await prisma.platformAdmin.findUnique({
    where: { id: adminId },
    select: { passwordHash: true, totpSecretEnc: true, totpEnabledAt: true, totpLastStep: true },
  });
  if (!admin?.totpEnabledAt || !admin.totpSecretEnc) throw new AppError(400, 'التحقق الثنائي غير مفعّل');
  if (!(await bcrypt.compare(password, admin.passwordHash))) throw new AppError(400, 'كلمة المرور غير صحيحة');
  if (verifyTotp(decryptSecret(admin.totpSecretEnc), code, admin.totpLastStep) === null) {
    throw new AppError(400, 'رمز التحقق غير صحيح');
  }
  const updated = await prisma.platformAdmin.update({
    where: { id: adminId },
    data: { totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null, sessionVersion: { increment: 1 } },
    select: { id: true, email: true, sessionVersion: true },
  });
  return signPlatformAdminToken(updated);
}
