import type { AccountKind, AccountNature, Prisma } from '@prisma/client';
import { statementTypeFromAccountType } from '../../accounting/utils/account-kind';
import { legacyTrim } from './legacy-values';
import type { LegacyAccountMasterRow } from '../services/legacy-coa-data.service';
import type { ClassifiedAccountReference } from '../services/account-classifier.service';

export interface CoaTransformInput {
  companyId: string;
  master?: LegacyAccountMasterRow;
  derived?: ClassifiedAccountReference;
  parentLegacyCode: string | null;
}

function mapLegacyAccountTypeToErp(t: string): string | null {
  const x = t.trim().toUpperCase();
  if (x === '1' || x === 'A') return 'asset';
  if (x === '2' || x === 'L') return 'liability';
  if (x === '3' || x === 'E') return 'equity';
  if (x === '4' || x === 'R') return 'revenue';
  if (x === '5' || x === 'X') return 'expense';
  return null;
}

function mapLegacyNature(side: string): AccountNature {
  const s = side.trim().toUpperCase();
  if (s === 'C' || s === 'CR' || s === 'CREDIT') return 'CREDIT';
  return 'DEBIT';
}

function mapLegacyAccountKind(row: LegacyAccountMasterRow): AccountKind {
  if (row.hasChild) return 'HEADER';
  if (row.accountType.toUpperCase() === 'C') return 'HEADER';
  return 'POSTING';
}

function mapStatementType(reportType: string, accountType: string | null): 'BALANCE_SHEET' | 'INCOME_STATEMENT' {
  const rt = reportType.trim().toUpperCase();
  if (rt === 'P') return 'INCOME_STATEMENT';
  if (rt === 'I' || rt === 'M') return 'BALANCE_SHEET';
  const fromType = statementTypeFromAccountType(accountType);
  return fromType ?? 'BALANCE_SHEET';
}

function mapCostCenter(ccType: string): { requiresCostCenter: boolean; costCenterRequired: string } {
  const t = ccType.trim().toUpperCase();
  if (t === 'W') return { requiresCostCenter: true, costCenterRequired: 'إجباري' };
  if (t === 'O') return { requiresCostCenter: false, costCenterRequired: 'اختياري' };
  return { requiresCostCenter: false, costCenterRequired: 'بدون' };
}

export function transformMasterAccount(
  row: LegacyAccountMasterRow,
  companyId: string
): Prisma.AccountCreateInput {
  const code = row.accountCode;
  const accountType = mapLegacyAccountTypeToErp(row.accountType) ?? inferTypeFromCode(code);
  const cc = mapCostCenter(row.ccType);
  const accountKind = mapLegacyAccountKind(row);
  const accountNature = mapLegacyNature(row.accountSide);
  const statementType = mapStatementType(row.reportType, accountType);

  return {
    company: { connect: { id: companyId } },
    code,
    arabicName: row.arabicName || code,
    englishName: row.englishName || null,
    accountType,
    accountSide: accountNature === 'CREDIT' ? 'دائن' : 'مدين',
    accountNature,
    accountKind,
    statementType,
    requiresCostCenter: cc.requiresCostCenter,
    costCenterRequired: cc.costCenterRequired,
    currencyCode: row.currencyCode || null,
    isActive: !row.deleted,
    deletedAt: null,
  };
}

export function transformDerivedGlAccount(
  ref: ClassifiedAccountReference,
  companyId: string,
  parentMaster?: LegacyAccountMasterRow
): Prisma.AccountCreateInput {
  const code = ref.code;
  const accountType = parentMaster
    ? mapLegacyAccountTypeToErp(parentMaster.accountType) ?? inferTypeFromCode(code)
    : inferTypeFromCode(code);
  const accountNature = parentMaster ? mapLegacyNature(parentMaster.accountSide) : mapLegacyNature('D');
  const statementType = parentMaster
    ? mapStatementType(parentMaster.reportType, accountType)
    : statementTypeFromAccountType(accountType) ?? 'BALANCE_SHEET';

  return {
    company: { connect: { id: companyId } },
    code,
    arabicName: ref.suggestedArabicName || `[GL] ${code}`,
    englishName: null,
    accountType,
    accountSide: accountNature === 'CREDIT' ? 'دائن' : 'مدين',
    accountNature,
    accountKind: 'POSTING',
    statementType,
    requiresCostCenter: false,
    costCenterRequired: 'بدون',
    currencyCode: parentMaster?.currencyCode || null,
    isActive: true,
    deletedAt: null,
  };
}

function inferTypeFromCode(code: string): string | null {
  const first = code.charAt(0);
  switch (first) {
    case '1':
      return 'asset';
    case '2':
      return 'liability';
    case '3':
      return 'equity';
    case '4':
      return 'revenue';
    case '5':
      return 'expense';
    default:
      return null;
  }
}

export function resolveParentLegacyCode(
  row: LegacyAccountMasterRow,
  masterByCode: Map<string, LegacyAccountMasterRow>
): string | null {
  const parent = legacyTrim(row.parentAccount);
  if (!parent) return null;
  if (masterByCode.has(parent)) return parent;
  return null;
}
