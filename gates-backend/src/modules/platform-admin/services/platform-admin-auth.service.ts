import bcrypt from 'bcryptjs';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { signPlatformAdminToken } from '../platform-admin-token';

// Same idea as the tenant login: always run a bcrypt compare so timing does not reveal emails.
const DUMMY_HASH = '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234';

export function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function loginPlatformAdmin(email: string, password: string) {
  const admin = await prisma.platformAdmin.findUnique({
    where: { email: normalizeAdminEmail(email) },
    select: { id: true, email: true, name: true, passwordHash: true, isActive: true },
  });
  const ok = await bcrypt.compare(password, admin?.passwordHash ?? DUMMY_HASH);
  if (!admin || !ok || !admin.isActive) {
    throw new AppError(401, 'البريد الإلكتروني أو كلمة المرور غير صحيحة');
  }
  await prisma.platformAdmin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  const token = signPlatformAdminToken(admin);
  return { ...token, admin: { id: admin.id, email: admin.email, name: admin.name } };
}

export async function listPlatformAdmins() {
  return prisma.platformAdmin.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true, name: true, isActive: true, lastLoginAt: true, createdAt: true },
  });
}

export async function createPlatformAdmin(input: { email: string; password: string; name?: string | null }) {
  const email = normalizeAdminEmail(input.email);
  const exists = await prisma.platformAdmin.findUnique({ where: { email }, select: { id: true } });
  if (exists) throw new AppError(409, 'يوجد مدير منصة بهذا البريد بالفعل');
  return prisma.platformAdmin.create({
    data: { email, name: input.name ?? null, passwordHash: await bcrypt.hash(input.password, 12) },
    select: { id: true, email: true, name: true, isActive: true, lastLoginAt: true, createdAt: true },
  });
}

export async function setPlatformAdminActive(actorId: string, adminId: string, isActive: boolean) {
  if (actorId === adminId && !isActive) throw new AppError(400, 'لا يمكنك إيقاف حسابك الحالي');
  if (!isActive) {
    const remaining = await prisma.platformAdmin.count({ where: { isActive: true, id: { not: adminId } } });
    if (remaining === 0) throw new AppError(400, 'يجب أن يبقى مدير منصة واحد مفعّل على الأقل');
  }
  return prisma.platformAdmin.update({
    where: { id: adminId },
    data: { isActive },
    select: { id: true, email: true, name: true, isActive: true, lastLoginAt: true, createdAt: true },
  });
}

export async function changePlatformAdminPassword(adminId: string, currentPassword: string, newPassword: string) {
  const admin = await prisma.platformAdmin.findUnique({ where: { id: adminId }, select: { passwordHash: true } });
  if (!admin || !(await bcrypt.compare(currentPassword, admin.passwordHash))) {
    throw new AppError(400, 'كلمة المرور الحالية غير صحيحة');
  }
  await prisma.platformAdmin.update({
    where: { id: adminId },
    data: { passwordHash: await bcrypt.hash(newPassword, 12) },
  });
}
