/** Egyptian standard chart — ordered parents before children. */
export type CoaTemplateRow = {
  code: string;
  arabicName: string;
  englishName?: string;
  accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  parentCode?: string;
  accountSide?: 'debit' | 'credit';
};

export type CoaIndustryKey = 'general' | 'trading' | 'contracting' | 'retail';

const CORE_EGYPTIAN_COA: CoaTemplateRow[] = [
  {
    code: '1',
    arabicName: 'الأصول',
    englishName: 'Assets',
    accountType: 'asset',
    accountSide: 'debit',
  },
  {
    code: '11',
    arabicName: 'الأصول المتداولة',
    englishName: 'Current Assets',
    accountType: 'asset',
    parentCode: '1',
  },
  {
    code: '111',
    arabicName: 'النقدية وما في حكمها',
    englishName: 'Cash & Cash Equivalents',
    accountType: 'asset',
    parentCode: '11',
  },
  {
    code: '1111',
    arabicName: 'الخزينة الرئيسية',
    englishName: 'Main Cash Safe',
    accountType: 'asset',
    parentCode: '111',
    accountSide: 'debit',
  },
  {
    code: '1112',
    arabicName: 'البنوك والحسابات الجارية',
    englishName: 'Banks & Current Accounts',
    accountType: 'asset',
    parentCode: '111',
    accountSide: 'debit',
  },
  {
    code: '112',
    arabicName: 'العملاء والمدينون',
    englishName: 'Trade Receivables',
    accountType: 'asset',
    parentCode: '11',
  },
  {
    code: '1121',
    arabicName: 'حسابات العملاء التجاريين',
    englishName: 'Trade Customers (AR)',
    accountType: 'asset',
    parentCode: '112',
    accountSide: 'debit',
  },
  {
    code: '113',
    arabicName: 'أوراق القبض والشيكات',
    englishName: 'Notes & Cheques Receivable',
    accountType: 'asset',
    parentCode: '11',
  },
  {
    code: '1131',
    arabicName: 'أوراق قبض تحت اليد',
    englishName: 'Cheques in Hand',
    accountType: 'asset',
    parentCode: '113',
    accountSide: 'debit',
  },
  {
    code: '1132',
    arabicName: 'أوراق قبض برسم التحصيل',
    englishName: 'Cheques Under Collection',
    accountType: 'asset',
    parentCode: '113',
    accountSide: 'debit',
  },
  {
    code: '114',
    arabicName: 'المخزون',
    englishName: 'Inventory',
    accountType: 'asset',
    parentCode: '11',
  },
  {
    code: '1141',
    arabicName: 'مخزون بضاعة بغرض البيع',
    englishName: 'Merchandise Inventory',
    accountType: 'asset',
    parentCode: '114',
    accountSide: 'debit',
  },
  {
    code: '1142',
    arabicName: 'مخزون مواد خام',
    englishName: 'Raw Materials',
    accountType: 'asset',
    parentCode: '114',
    accountSide: 'debit',
  },
  {
    code: '1143',
    arabicName: 'إنتاج تحت التشغيل (WIP)',
    englishName: 'Work in Progress',
    accountType: 'asset',
    parentCode: '114',
    accountSide: 'debit',
  },
  {
    code: '115',
    arabicName: 'مصلحة الضرائب والخصم',
    englishName: 'Tax Authority Receivables',
    accountType: 'asset',
    parentCode: '11',
  },
  {
    code: '1151',
    arabicName: 'ضريبة خصم وتحصيل 1% أ.ت.ص',
    englishName: 'WHT Receivable 1%',
    accountType: 'asset',
    parentCode: '115',
    accountSide: 'debit',
  },
  {
    code: '1152',
    arabicName: 'ضريبة مدخلات (VAT Input)',
    englishName: 'VAT Input',
    accountType: 'asset',
    parentCode: '115',
    accountSide: 'debit',
  },
  {
    // Legacy parity: SolafAccount ("سلف") + OhdaAccount ("عهدة") — employee
    // loan/advance and custody GL slots (untAAOptions.pas / untDFOptions.pas).
    code: '116',
    arabicName: 'سلف وعهد الموظفين',
    englishName: 'Employee Loans & Custody Advances',
    accountType: 'asset',
    parentCode: '11',
  },
  {
    code: '1161',
    arabicName: 'سلف وعهد الموظفين',
    englishName: 'Employee Loans & Custody Advances',
    accountType: 'asset',
    parentCode: '116',
    accountSide: 'debit',
  },
  {
    code: '12',
    arabicName: 'أصول غير متداولة',
    englishName: 'Non-Current Assets',
    accountType: 'asset',
    parentCode: '1',
  },
  {
    code: '121',
    arabicName: 'أصول ثابتة',
    englishName: 'Fixed Assets',
    accountType: 'asset',
    parentCode: '12',
  },
  {
    code: '1210',
    arabicName: 'أصول ومعدات',
    englishName: 'Property & Equipment',
    accountType: 'asset',
    parentCode: '121',
    accountSide: 'debit',
  },

  {
    code: '2',
    arabicName: 'الالتزامات',
    englishName: 'Liabilities',
    accountType: 'liability',
    accountSide: 'credit',
  },
  {
    code: '21',
    arabicName: 'الالتزامات المتداولة',
    englishName: 'Current Liabilities',
    accountType: 'liability',
    parentCode: '2',
  },
  {
    code: '211',
    arabicName: 'الموردون والدائنون',
    englishName: 'Trade Payables',
    accountType: 'liability',
    parentCode: '21',
  },
  {
    code: '2111',
    arabicName: 'حسابات الموردين التجاريين',
    englishName: 'Trade Suppliers (AP)',
    accountType: 'liability',
    parentCode: '211',
    accountSide: 'credit',
  },
  {
    code: '212',
    arabicName: 'أوراق الدفع والشيكات الصادرة',
    englishName: 'Notes & Cheques Payable',
    accountType: 'liability',
    parentCode: '21',
  },
  {
    code: '2121',
    arabicName: 'أوراق دفع للموردين',
    englishName: 'Supplier Notes Payable',
    accountType: 'liability',
    parentCode: '212',
    accountSide: 'credit',
  },
  {
    code: '213',
    arabicName: 'الضرائب المستحقة',
    englishName: 'Taxes Payable',
    accountType: 'liability',
    parentCode: '21',
  },
  {
    code: '2131',
    arabicName: 'ضريبة القيمة المضافة 14%',
    englishName: 'VAT Output 14%',
    accountType: 'liability',
    parentCode: '213',
    accountSide: 'credit',
  },
  {
    code: '2132',
    arabicName: 'ضريبة الخصم من المنبع',
    englishName: 'WHT Payable',
    accountType: 'liability',
    parentCode: '213',
    accountSide: 'credit',
  },
  {
    code: '214',
    arabicName: 'الدفعات المقدمة',
    englishName: 'Customer Advances',
    accountType: 'liability',
    parentCode: '21',
  },
  {
    code: '2141',
    arabicName: 'دفعات مقدمة من العملاء',
    englishName: 'Advance from Customers',
    accountType: 'liability',
    parentCode: '214',
    accountSide: 'credit',
  },

  {
    code: '3',
    arabicName: 'حقوق الملكية',
    englishName: 'Equity',
    accountType: 'equity',
    accountSide: 'credit',
    parentCode: '2',
  },
  {
    code: '31',
    arabicName: 'رأس المال وحقوق الشركاء',
    englishName: 'Capital & Partners',
    accountType: 'equity',
    parentCode: '3',
  },
  {
    code: '311',
    arabicName: 'رأس المال المدفوع',
    englishName: 'Paid-in Capital',
    accountType: 'equity',
    parentCode: '31',
    accountSide: 'credit',
  },
  {
    code: '321',
    arabicName: 'الأرباح والخسائر المرحلة',
    englishName: 'Retained Earnings',
    accountType: 'equity',
    parentCode: '31',
    accountSide: 'credit',
  },

  {
    code: '4',
    arabicName: 'الإيرادات',
    englishName: 'Revenues',
    accountType: 'revenue',
    accountSide: 'credit',
  },
  {
    code: '41',
    arabicName: 'الإيرادات التشغيلية',
    englishName: 'Operating Revenue',
    accountType: 'revenue',
    parentCode: '4',
  },
  {
    code: '411',
    arabicName: 'إيرادات المبيعات',
    englishName: 'Sales Revenue',
    accountType: 'revenue',
    parentCode: '41',
    accountSide: 'credit',
  },
  {
    code: '412',
    arabicName: 'خصم مسموح به',
    englishName: 'Sales Discount Allowed',
    accountType: 'revenue',
    parentCode: '41',
    accountSide: 'debit',
  },
  {
    code: '413',
    arabicName: 'مردودات المبيعات',
    englishName: 'Sales Returns',
    accountType: 'revenue',
    parentCode: '41',
    accountSide: 'debit',
  },
  {
    code: '416',
    arabicName: 'أرباح فروق العملة',
    englishName: 'Foreign Exchange Gain',
    accountType: 'revenue',
    parentCode: '41',
    accountSide: 'credit',
  },

  {
    code: '5',
    arabicName: 'المصروفات والتكاليف',
    englishName: 'Expenses & Costs',
    accountType: 'expense',
    accountSide: 'debit',
  },
  {
    code: '51',
    arabicName: 'تكلفة النشاط والمبيعات',
    englishName: 'Cost of Sales',
    accountType: 'expense',
    parentCode: '5',
  },
  {
    code: '511',
    arabicName: 'تكلفة البضاعة المباعة (COGS)',
    englishName: 'Cost of Goods Sold',
    accountType: 'expense',
    parentCode: '51',
    accountSide: 'debit',
  },
  {
    code: '512',
    arabicName: 'تكاليف تشغيل ومقاولي باطن',
    englishName: 'Subcontractor & Job Costs',
    accountType: 'expense',
    parentCode: '51',
    accountSide: 'debit',
  },
  {
    code: '513',
    arabicName: 'غرامات تأخير عقود',
    englishName: 'Contract Delay Penalties',
    accountType: 'expense',
    parentCode: '51',
    accountSide: 'debit',
  },
  {
    code: '52',
    arabicName: 'المصروفات العمومية والإدارية',
    englishName: 'G&A Expenses',
    accountType: 'expense',
    parentCode: '5',
  },
  {
    code: '521',
    arabicName: 'الرواتب والأجور',
    englishName: 'Payroll',
    accountType: 'expense',
    parentCode: '52',
    accountSide: 'debit',
  },
  {
    code: '522',
    arabicName: 'الإيجارات',
    englishName: 'Rent',
    accountType: 'expense',
    parentCode: '52',
    accountSide: 'debit',
  },
  {
    code: '523',
    arabicName: 'مياه وكهرباء وطاقة',
    englishName: 'Utilities',
    accountType: 'expense',
    parentCode: '52',
    accountSide: 'debit',
  },
  {
    code: '524',
    arabicName: 'مصاريف وعمولات بنكية',
    englishName: 'Bank Charges',
    accountType: 'expense',
    parentCode: '52',
    accountSide: 'debit',
  },
  {
    code: '525',
    arabicName: 'خسائر فروق العملة',
    englishName: 'Foreign Exchange Loss',
    accountType: 'expense',
    parentCode: '52',
    accountSide: 'debit',
  },
  {
    // Legacy parity: EhlakAccount ("إهلاك" = depreciation) — untAAOptions.pas / untDFOptions.pas.
    code: '526',
    arabicName: 'مصروف إهلاك',
    englishName: 'Depreciation Expense',
    accountType: 'expense',
    parentCode: '52',
    accountSide: 'debit',
  },
  {
    // Legacy parity: ItemLossAccount — untPInovice.pas / untSetting.pas.
    code: '527',
    arabicName: 'عجز وهلاك المخزون',
    englishName: 'Inventory Shrinkage & Losses',
    accountType: 'expense',
    parentCode: '52',
    accountSide: 'debit',
  },
  {
    // Legacy parity: MarketingExpensesAccount — UntProjectContract.pas.
    code: '528',
    arabicName: 'مصروفات تسويق وعمولات',
    englishName: 'Marketing Expenses & Commissions',
    accountType: 'expense',
    parentCode: '52',
    accountSide: 'debit',
  },
];

/** Contracting / construction vertical extras */
const CONTRACTING_COA: CoaTemplateRow[] = [
  {
    code: '118',
    arabicName: 'ضمانات وتأمينات أعمال',
    englishName: 'Contract Retentions',
    accountType: 'asset',
    parentCode: '11',
  },
  {
    code: '119',
    arabicName: 'دفعات مقدمة لمقاولي الباطن',
    englishName: 'Advances to Subcontractors',
    accountType: 'asset',
    parentCode: '11',
  },
  {
    code: '1191',
    arabicName: 'دفعات مقدمة لمقاولي الباطن',
    englishName: 'Subcontractor Advances',
    accountType: 'asset',
    parentCode: '119',
    accountSide: 'debit',
  },
  {
    code: '1181',
    arabicName: 'تأمينات أعمال محتجزة لدى العملاء',
    englishName: 'Retention Receivable from Customers',
    accountType: 'asset',
    parentCode: '118',
    accountSide: 'debit',
  },
  {
    code: '218',
    arabicName: 'ضمانات مستحقة لمقاولي الباطن',
    englishName: 'Subcontractor Retentions',
    accountType: 'liability',
    parentCode: '21',
  },
  {
    code: '2181',
    arabicName: 'تأمينات محتجزة لمقاولي الباطن',
    englishName: 'Retention Payable to Subcontractors',
    accountType: 'liability',
    parentCode: '218',
    accountSide: 'credit',
  },
  {
    code: '415',
    arabicName: 'إيرادات عقود ومقاولات',
    englishName: 'Contract Revenue',
    accountType: 'revenue',
    parentCode: '41',
    accountSide: 'credit',
  },
];

export function sortCoaRows<T extends { code: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.code.length - b.code.length || a.code.localeCompare(b.code));
}

export function getCoaTemplateRows(industry: CoaIndustryKey | string = 'general'): CoaTemplateRow[] {
  const key = String(industry).toLowerCase();
  const rows = [...CORE_EGYPTIAN_COA];
  if (key === 'contracting' || key === 'construction') {
    rows.push(...CONTRACTING_COA);
  }
  return sortCoaRows(rows);
}

/** @deprecated Use getCoaTemplateRows — kept for imports */
export const DEFAULT_COA_ROWS = getCoaTemplateRows('general');

export type DefaultCoaRow = CoaTemplateRow;
