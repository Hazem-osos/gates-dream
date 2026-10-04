import fs from 'fs';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../src/shared/database/prisma';

const companyId = '00000000-0000-0000-0000-000000000001';
const password = `Qa-${crypto.randomBytes(9).toString('hex')}`;
const passwordHash = await bcrypt.hash(password, 10);

async function ensureUser(username: string, firstName: string) {
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { passwordHash, isActive: true, companyId } });
    return existing.id;
  }
  const created = await prisma.user.create({
    data: {
      companyId,
      email: `${username}@pos-qa.local`,
      username,
      passwordHash,
      firstName,
      preferredLanguage: 'ar',
      isActive: true,
    },
  });
  return created.id;
}

async function grant(userId: string, resource: string, action: string) {
  const existing = await prisma.userPermission.findFirst({ where: { userId, companyId, resource, action } });
  if (existing) {
    if (!existing.allow) await prisma.userPermission.update({ where: { id: existing.id }, data: { allow: true } });
    return;
  }
  await prisma.userPermission.create({ data: { userId, companyId, resource, action, allow: true } });
}

const cashierId = await ensureUser('pos-qa-cashier', 'كاشير');
const supervisorId = await ensureUser('pos-qa-supervisor', 'مشرف');
for (const action of ['view', 'edit', 'post', 'discount', 'override_tier_price']) {
  await grant(cashierId, 'pos', action);
}
await grant(cashierId, 'company', 'view');
await grant(cashierId, 'branch', 'view');
for (const action of ['view', 'edit', 'post', 'delete', 'approve', 'print', 'override_tier_price', 'unpost', 'reopen_shift', 'discount', 'reprint', 'void']) {
  await grant(supervisorId, 'pos', action);
}
await grant(supervisorId, 'company', 'view');
await grant(supervisorId, 'branch', 'view');

const source = await prisma.posTerminal.findFirst({
  where: { companyId, isActive: true },
  orderBy: { createdAt: 'asc' },
});
if (!source) throw new Error('no terminal');
console.log('source-terminal', source.deviceCode, source.name);
let terminal = await prisma.posTerminal.findFirst({ where: { companyId, deviceCode: 'POS-QA' } });
if (!terminal) {
  terminal = await prisma.posTerminal.create({
    data: {
      companyId,
      branchId: source.branchId,
      warehouseId: source.warehouseId,
      safeId: source.safeId,
      bankAccountId: source.bankAccountId,
      name: 'جهاز الاختبار',
      deviceCode: 'POS-QA',
      isActive: true,
      offlineEnabled: false,
    },
  });
}

const water = await prisma.item.findFirst({
  where: { companyId, barcode: '6221000000011' },
  include: { units: true },
});
const rice = await prisma.item.findFirst({ where: { companyId, barcode: '6221000000028' } });
if (!water || !rice || water.units.length === 0) throw new Error('fixture items missing');
const unitId = water.units[0].unitId;

const rule = await prisma.posBarcodeRule.findFirst({ where: { companyId, prefix: '22' } });
if (!rule) {
  await prisma.posBarcodeRule.create({
    data: {
      companyId,
      name: 'وزن',
      prefix: '22',
      itemStart: 2,
      itemLength: 5,
      valueStart: 7,
      valueLength: 5,
      valueKind: 'WEIGHT',
      decimals: 3,
      isActive: true,
    },
  });
}
const weighted = await prisma.itemBarcode.findFirst({ where: { companyId, barcode: '12345' } });
if (!weighted) {
  await prisma.itemBarcode.create({ data: { companyId, itemId: water.id, unitId, barcode: '12345' } });
}
const unitCode = await prisma.itemBarcode.findFirst({ where: { companyId, barcode: '6221000000099' } });
if (!unitCode) {
  await prisma.itemBarcode.create({ data: { companyId, itemId: water.id, unitId, barcode: '6221000000099' } });
}

const offer = await prisma.itemOffer.findFirst({ where: { companyId, nameAr: 'عرض اختبار نقطة البيع' } });
if (!offer) {
  await prisma.itemOffer.create({
    data: {
      companyId,
      nameAr: 'عرض اختبار نقطة البيع',
      how: 'additional-quantity',
      type: 'sales',
      source: 'all',
      fromItemId: water.id,
      quantity: 1,
      offerQuantity: 1,
      toItemId: rice.id,
      applyToAllParties: true,
      applyToAllPatterns: true,
      fromDate: new Date('2026-01-01'),
      toDate: new Date('2027-01-01'),
      isActive: true,
    },
  });
}

const other = await prisma.company.findFirst({ where: { id: { not: companyId }, deletedAt: null }, select: { id: true, arabicName: true } });

fs.writeFileSync('/tmp/pos-qa-cred.json', JSON.stringify({ password, cashierId, supervisorId }), { mode: 0o600 });
console.log(JSON.stringify({
  cashierId,
  supervisorId,
  terminalId: terminal.id,
  waterId: water.id,
  riceId: rice.id,
  unitId,
  otherCompanyId: other?.id ?? null,
  otherCompany: other?.arabicName ?? null,
}, null, 2));
await prisma.$disconnect();
