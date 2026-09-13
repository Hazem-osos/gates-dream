import prisma from '../../shared/database/prisma';
import { logger } from '../../shared/logger';
import { invoiceM5Service } from '../invoices/services/invoice-m5.service';
import { invoicePostingOrchestrator } from '../invoices/services/invoice-posting-orchestrator';
import type { InvoicePostingContext } from '../invoices/types/invoice-posting.types';
import { cashTransactionService } from '../treasury/services/cash-transaction.service';
import { treasuryPostingService } from '../treasury/services/treasury-posting.service';
import { securitiesReceiptService } from '../accounting/services/securities-receipt.service';
import { securitiesPaymentService } from '../accounting/services/securities-payment.service';
import { journalEntryService } from '../accounting/services/journal-entry.service';
import { issueService } from '../inventory/services/issue.service';
import { receiptService } from '../inventory/services/receipt.service';
import { transferService } from '../inventory/services/transfer.service';
import { employeeService } from '../hr/services/employee.service';
import { contractingProjectService } from '../contracting/services/contracting-project.service';
import type { HazemSeedMaps } from './hazem-demo-seed.service';

const TAX = 14;
const DOC_DATE = new Date(Date.UTC(2026, 1, 15));

type TxParams = {
  companyId: string;
  ctx: InvoicePostingContext;
  maps: HazemSeedMaps;
  fiscalYearLegacyId: string;
};

function taxLine(
  itemId: string,
  unitId: string,
  qty: number,
  price: number,
  lineOrder: number
) {
  const total = qty * price;
  const taxAmount = (total * TAX) / 100;
  return {
    itemId,
    unitId,
    quantity: qty,
    baseQuantity: qty,
    price,
    taxPercent: TAX,
    taxAmount,
    lineOrder,
  };
}

async function ensurePostedPurchase(
  params: TxParams,
  invoiceNumber: string,
  supplierCode: string,
  itemSerial: string,
  qty: number,
  unitPrice: number
) {
  const existing = await prisma.invoice.findFirst({
    where: { companyId: params.companyId, invoiceNumber },
  });
  if (existing?.isPosted) return existing.id;

  const supplierId = params.maps.suppliers.get(supplierCode);
  const itemId = params.maps.items.get(itemSerial);
  const unitId = params.maps.units.get('PCS');
  const warehouseId = params.maps.warehouses.get('WH-GEN');
  if (!supplierId || !itemId || !unitId || !warehouseId) return null;

  const inv =
    existing ??
    (await invoiceM5Service.create(params.companyId, params.ctx.branchId, params.ctx.fiscalYearId, {
      invoiceKind: 'PURCHASE',
      invoiceNumber,
      date: DOC_DATE,
      currencyCode: 'EGP',
      exchangeRate: 1,
      withholdingTaxAmount: 0,
      supplierId,
      warehouseId,
      sourceYearId: params.fiscalYearLegacyId,
      lines: [taxLine(itemId, unitId, qty, unitPrice, 1)],
    }));

  if (!inv) return null;
  if (!inv.isPosted) {
    await invoicePostingOrchestrator.post(params.ctx, inv.id);
  }
  return inv.id;
}

async function ensurePostedSale(
  params: TxParams,
  invoiceNumber: string,
  customerCode: string,
  itemSerial: string,
  qty: number,
  unitPrice: number,
  post: boolean
) {
  const existing = await prisma.invoice.findFirst({
    where: { companyId: params.companyId, invoiceNumber },
  });
  if (existing && (post ? existing.isPosted : true)) return existing.id;

  const customerId = params.maps.customers.get(customerCode);
  const itemId = params.maps.items.get(itemSerial);
  const unitId = params.maps.units.get('PCS');
  const warehouseId = params.maps.warehouses.get('WH-GEN');
  if (!customerId || !itemId || !unitId || !warehouseId) return null;

  const inv =
    existing ??
    (await invoiceM5Service.create(params.companyId, params.ctx.branchId, params.ctx.fiscalYearId, {
      invoiceKind: 'SALE',
      invoiceNumber,
      date: DOC_DATE,
      currencyCode: 'EGP',
      exchangeRate: 1,
      withholdingTaxAmount: 0,
      customerId,
      warehouseId,
      sourceYearId: params.fiscalYearLegacyId,
      lines: [taxLine(itemId, unitId, qty, unitPrice, 1)],
    }));

  if (!inv) return null;
  if (post && !inv.isPosted) {
    await invoicePostingOrchestrator.post(params.ctx, inv.id);
  }
  return inv.id;
}

export async function seedHazemDemoTransactions(params: TxParams) {
  const summary: Record<string, number> = {
    purchaseInvoices: 0,
    salesInvoices: 0,
    salesDrafts: 0,
    cashReceipts: 0,
    cashPayments: 0,
    securitiesReceipts: 0,
    securitiesPayments: 0,
    journalEntries: 0,
    stockIssues: 0,
    stockReceipts: 0,
    stockTransfers: 0,
    employees: 0,
    projects: 0,
  };

  const purchases: [string, string, string, number, number][] = [
    ['HAZEM-PI-001', 'SUP-002', 'FG-DELL-G15', 10, 24000],
    ['HAZEM-PI-002', 'SUP-006', 'FG-HP-LJ', 8, 8000],
    ['HAZEM-PI-003', 'SUP-004', 'FG-RTR-WIFI6', 20, 2800],
    ['HAZEM-PI-004', 'SUP-007', 'RM-CAT6-305', 15, 1800],
    ['HAZEM-PI-005', 'SUP-001', 'RM-SCH-16A', 100, 120],
  ];
  for (const row of purchases) {
    try {
      const id = await ensurePostedPurchase(params, row[0], row[1], row[2], row[3], row[4]);
      if (id) summary.purchaseInvoices += 1;
    } catch (e) {
      logger.warn({ e, row }, 'Hazem seed: purchase skipped');
    }
  }

  const salesPosted: [string, string, string, number, number][] = [
    ['HAZEM-SI-001', 'CUST-001', 'FG-DELL-G15', 2, 30000],
    ['HAZEM-SI-002', 'CUST-003', 'FG-SAM-27', 5, 7200],
    ['HAZEM-SI-003', 'CUST-002', 'FG-HP-LJ', 3, 10500],
    ['HAZEM-SI-004', 'CUST-006', 'FG-RTR-WIFI6', 4, 3900],
    ['HAZEM-SI-005', 'CUST-004', 'FG-KEY-MK', 10, 1800],
    ['HAZEM-SI-006', 'CUST-009', 'FG-FW-UTM', 1, 19500],
    ['HAZEM-SI-007', 'CUST-007', 'FG-UPS-1K', 2, 4800],
    ['HAZEM-SI-008', 'CUST-010', 'TL-SCREW-SET', 6, 550],
  ];
  for (const row of salesPosted) {
    try {
      const id = await ensurePostedSale(params, row[0], row[1], row[2], row[3], row[4], true);
      if (id) summary.salesInvoices += 1;
    } catch (e) {
      logger.warn({ e, row }, 'Hazem seed: sale skipped');
    }
  }

  for (const num of ['HAZEM-SI-DR-01', 'HAZEM-SI-DR-02']) {
    try {
      const id = await ensurePostedSale(params, num, 'CUST-005', 'FG-SAM-27', 1, 7200, false);
      if (id) summary.salesDrafts += 1;
    } catch (e) {
      logger.warn({ e, num }, 'Hazem seed: sale draft skipped');
    }
  }

  try {
    const srItem = params.maps.items.get('FG-SAM-27');
    const srCust = params.maps.customers.get('CUST-003');
    const unitId = params.maps.units.get('PCS');
    const wh = params.maps.warehouses.get('WH-GEN');
    if (srItem && srCust && unitId && wh) {
      const retNum = 'HAZEM-SR-001';
      let ret = await prisma.invoice.findFirst({
        where: { companyId: params.companyId, invoiceNumber: retNum },
      });
      if (!ret) {
        ret = await invoiceM5Service.create(
          params.companyId,
          params.ctx.branchId,
          params.ctx.fiscalYearId,
          {
            invoiceKind: 'SALE_RETURN',
            invoiceNumber: retNum,
            date: DOC_DATE,
            currencyCode: 'EGP',
            exchangeRate: 1,
            withholdingTaxAmount: 0,
            customerId: srCust,
            warehouseId: wh,
            sourceYearId: params.fiscalYearLegacyId,
            lines: [taxLine(srItem, unitId, 1, 7200, 1)],
          }
        );
      }
      if (ret && !ret.isPosted) await invoicePostingOrchestrator.post(params.ctx, ret.id);
    }
  } catch (e) {
    logger.warn({ e }, 'Hazem seed: sale return skipped');
  }

  const safeMain = params.maps.safes.get('SAFE-MAIN');
  const treasuryCtx = {
    companyId: params.companyId,
    branchId: params.ctx.branchId,
    fiscalYearId: params.ctx.fiscalYearId,
    userId: params.ctx.userId,
  };

  for (let i = 1; i <= 6; i++) {
    const voucher = `HAZEM-CR-${String(i).padStart(3, '0')}`;
    const exists = await prisma.cashTransaction.findFirst({
      where: { companyId: params.companyId, voucherNumber: voucher },
    });
    if (exists) continue;
    const cust = params.maps.customers.get(`CUST-00${((i - 1) % 10) + 1}`);
    if (!cust || !safeMain) continue;
    try {
      const tx = await cashTransactionService.create(
        params.companyId,
        params.ctx.branchId,
        params.ctx.fiscalYearId,
        {
          transactionKind: 'RECEIPT',
          voucherNumber: voucher,
          date: DOC_DATE,
          amount: 5000 + i * 1200,
          currencyCode: 'EGP',
          customerId: cust,
          safeId: safeMain,
          description: `سند قبض تجريبي ${i}`,
        }
      );
      await treasuryPostingService.postCashTransaction(treasuryCtx, tx.id);
      summary.cashReceipts += 1;
    } catch (e) {
      logger.warn({ e, voucher }, 'Hazem seed: cash receipt skipped');
    }
  }

  for (let i = 1; i <= 4; i++) {
    const voucher = `HAZEM-CP-${String(i).padStart(3, '0')}`;
    const exists = await prisma.cashTransaction.findFirst({
      where: { companyId: params.companyId, voucherNumber: voucher },
    });
    if (exists) continue;
    const sup = params.maps.suppliers.get(`SUP-00${i}`);
    if (!sup || !safeMain) continue;
    try {
      const tx = await cashTransactionService.create(
        params.companyId,
        params.ctx.branchId,
        params.ctx.fiscalYearId,
        {
          transactionKind: 'PAYMENT',
          voucherNumber: voucher,
          date: DOC_DATE,
          amount: 3000 + i * 800,
          currencyCode: 'EGP',
          supplierId: sup,
          safeId: safeMain,
          description: `سند صرف تجريبي ${i}`,
        }
      );
      await treasuryPostingService.postCashTransaction(treasuryCtx, tx.id);
      summary.cashPayments += 1;
    } catch (e) {
      logger.warn({ e, voucher }, 'Hazem seed: cash payment skipped');
    }
  }

  const secSpecs: { num: string; cust: string; amount: number; due: Date; desc: string }[] = [
    { num: 'CHK-UC-001', cust: 'CUST-001', amount: 25000, due: new Date('2026-04-01'), desc: 'تحت التحصيل' },
    { num: 'CHK-UC-002', cust: 'CUST-002', amount: 18000, due: new Date('2026-05-15'), desc: 'تحت التحصيل' },
    { num: 'CHK-UC-003', cust: 'CUST-006', amount: 32000, due: new Date('2026-06-01'), desc: 'تحت التحصيل' },
    { num: 'CHK-CL-001', cust: 'CUST-003', amount: 15000, due: new Date('2026-02-01'), desc: 'تم التحصيل' },
    { num: 'CHK-CL-002', cust: 'CUST-009', amount: 22000, due: new Date('2026-02-10'), desc: 'تم التحصيل' },
    { num: 'CHK-BN-001', cust: 'CUST-004', amount: 9000, due: new Date('2026-03-01'), desc: 'شيك مرتد' },
  ];
  for (const s of secSpecs) {
    const exists = await prisma.securitiesReceipt.findFirst({
      where: { companyId: params.companyId, receiptNumber: s.num },
    });
    if (exists) continue;
    const customerId = params.maps.customers.get(s.cust);
    if (!customerId) continue;
    try {
      await securitiesReceiptService.createSecuritiesReceipt(params.companyId, {
        receiptNumber: s.num,
        date: DOC_DATE,
        securityType: 'check',
        customerId,
        issuerBank: 'البنك الأهلي',
        securityNumber: s.num,
        dueDate: s.due,
        amount: s.amount,
        currencyCode: 'EGP',
        description: s.desc,
      });
      summary.securitiesReceipts += 1;
    } catch (e) {
      logger.warn({ e, num: s.num }, 'Hazem seed: securities receipt skipped');
    }
  }

  for (let i = 1; i <= 2; i++) {
    const num = `PAY-CHK-00${i}`;
    const exists = await prisma.securitiesPayment.findFirst({
      where: { companyId: params.companyId, paymentNumber: num },
    });
    if (exists) continue;
    const supplierId = params.maps.suppliers.get(`SUP-00${i}`);
    if (!supplierId) continue;
    try {
      await securitiesPaymentService.createSecuritiesPayment(params.companyId, {
        paymentNumber: num,
        date: DOC_DATE,
        securityType: 'check',
        supplierId,
        securityNumber: num,
        dueDate: new Date('2026-07-01'),
        amount: 12000 * i,
        currencyCode: 'EGP',
        description: 'شيك صادر للدفع',
      });
      summary.securitiesPayments += 1;
    } catch (e) {
      logger.warn({ e, num }, 'Hazem seed: securities payment skipped');
    }
  }

  const expense = await prisma.account.findFirst({
    where: { companyId: params.companyId, code: '5210', deletedAt: null },
  });
  const capital = await prisma.account.findFirst({
    where: { companyId: params.companyId, code: '3110', deletedAt: null },
  });
  const ccAdm = params.maps.costCenters.get('CC-ADM');

  const apAcc = await prisma.account.findFirst({
    where: { companyId: params.companyId, code: '2110', deletedAt: null },
  });
  const cashAcc = await prisma.account.findFirst({
    where: { companyId: params.companyId, code: '1111', deletedAt: null },
  });

  const jeSpecs: {
    num: string;
    lines: { accountId: string; debit: number; credit: number; cc?: string }[];
  }[] = [];
  if (expense && apAcc && ccAdm) {
    jeSpecs.push({
      num: 'HAZEM-JE-001',
      lines: [
        { accountId: expense.id, debit: 15000, credit: 0, cc: ccAdm },
        { accountId: apAcc.id, debit: 0, credit: 15000, cc: ccAdm },
      ],
    });
  }
  if (capital && cashAcc) {
    jeSpecs.push({
      num: 'HAZEM-JE-002',
      lines: [
        { accountId: cashAcc.id, debit: 500000, credit: 0 },
        { accountId: capital.id, debit: 0, credit: 500000 },
      ],
    });
  }

  for (const je of jeSpecs) {
    const exists = await prisma.journalEntry.findFirst({
      where: { companyId: params.companyId, voucherNumber: je.num },
    });
    if (exists?.isPosted) continue;
    try {
      const created = await journalEntryService.createJournalEntry(
        params.companyId,
        params.ctx.userId,
        {
          voucherNumber: je.num,
          date: DOC_DATE,
          description: `قيد تجريبي ${je.num}`,
          currencyCode: 'EGP',
          lines: je.lines.map((l, idx) => ({
            accountId: l.accountId,
            costCenterId: l.cc,
            debit: l.debit,
            credit: l.credit,
            lineOrder: idx + 1,
            description: je.num,
          })),
        },
        { branchId: params.ctx.branchId, fiscalYearId: params.ctx.fiscalYearId }
      );
      if (!created) continue;
      await journalEntryService.postJournalEntry(params.companyId, created.id, {
        branchId: params.ctx.branchId,
        fiscalYearId: params.ctx.fiscalYearId,
        userId: params.ctx.userId,
      });
      summary.journalEntries += 1;
    } catch (e) {
      logger.warn({ e, num: je.num }, 'Hazem seed: journal skipped');
    }
  }

  const whGen = params.maps.warehouses.get('WH-GEN');
  const whSpr = params.maps.warehouses.get('WH-SPR');
  const issueItem = params.maps.items.get('TL-SCREW-SET');
  if (whGen && issueItem) {
    for (let i = 1; i <= 3; i++) {
      const serial = `HAZEM-IS-${i}`;
      const exists = await prisma.issue.findFirst({
        where: { companyId: params.companyId, serial },
      });
      if (exists) continue;
      try {
        const doc = await issueService.createIssue(params.companyId, {
          companyId: params.companyId,
          branchId: params.ctx.branchId,
          serial,
          date: DOC_DATE.toISOString().slice(0, 10),
          warehouseId: whGen,
          description: `إذن صرف ${i}`,
          lines: [{ itemId: issueItem, quantity: 1 }],
        });
        await issueService.postIssue(params.companyId, doc.id);
        summary.stockIssues += 1;
      } catch (e) {
        logger.warn({ e, serial }, 'Hazem seed: issue skipped');
      }
    }
  }

  const rcptItem = params.maps.items.get('RM-SCH-16A');
  if (whGen && rcptItem) {
    for (let i = 1; i <= 3; i++) {
      const serial = `HAZEM-RC-${i}`;
      const exists = await prisma.receipt.findFirst({
        where: { companyId: params.companyId, serial },
      });
      if (exists) continue;
      try {
        const doc = await receiptService.createReceipt(params.companyId, {
          companyId: params.companyId,
          branchId: params.ctx.branchId,
          serial,
          date: DOC_DATE.toISOString().slice(0, 10),
          warehouseId: whGen,
          description: `إذن إضافة ${i}`,
          lines: [{ itemId: rcptItem, quantity: 5, unitPrice: 120 }],
        });
        await receiptService.postReceipt(params.companyId, doc.id);
        summary.stockReceipts += 1;
      } catch (e) {
        logger.warn({ e, serial }, 'Hazem seed: receipt skipped');
      }
    }
  }

  const trItem = params.maps.items.get('FG-KEY-MK');
  if (whGen && whSpr && trItem) {
    for (let i = 1; i <= 2; i++) {
      const serial = `HAZEM-TR-${i}`;
      const exists = await prisma.transfer.findFirst({
        where: { companyId: params.companyId, serial },
      });
      if (exists) continue;
      try {
        const doc = await transferService.createTransfer(params.companyId, {
          companyId: params.companyId,
          branchId: params.ctx.branchId,
          serial,
          date: DOC_DATE.toISOString().slice(0, 10),
          fromWarehouseId: whGen,
          toWarehouseId: whSpr,
          description: `تحويل مخزني ${i}`,
          lines: [{ itemId: trItem, quantity: 2 }],
        });
        await transferService.postTransfer(params.companyId, doc.id);
        summary.stockTransfers += 1;
      } catch (e) {
        logger.warn({ e, serial }, 'Hazem seed: transfer skipped');
      }
    }
  }

  const empNames = [
    'أحمد محمود',
    'سارة علي',
    'محمد حسن',
    'نوران خالد',
    'يوسف إبراهيم',
    'ليلى عبدالله',
  ];
  for (let i = 0; i < empNames.length; i++) {
    const serial = `EMP-HAZ-${String(i + 1).padStart(2, '0')}`;
    const exists = await prisma.employee.findFirst({
      where: { companyId: params.companyId, serial },
    });
    if (exists) continue;
    try {
      await employeeService.createEmployee(params.companyId, {
        serial,
        arabicName: empNames[i],
        basicSalary: 8000 + i * 1500,
        joinDate: DOC_DATE,
      });
      summary.employees += 1;
    } catch (e) {
      logger.warn({ e, serial }, 'Hazem seed: employee skipped');
    }
  }

  const projCust = params.maps.customers.get('CUST-001');
  if (projCust) {
    for (let i = 1; i <= 2; i++) {
      const code = `HAZEM-PRJ-${i}`;
      const exists = await prisma.contractingProject.findFirst({
        where: { companyId: params.companyId, projectCode: code },
      });
      if (exists) {
        summary.projects += 1;
        continue;
      }
      try {
        await contractingProjectService.create(params.companyId, {
          projectCode: code,
          projectName: i === 1 ? 'مشروع شبكات العاصمة' : 'مشروع تجمع خامس',
          customerId: projCust,
          contractValue: i === 1 ? 2_500_000 : 1_200_000,
          advancePaymentBalance: 100_000,
          advanceDeductionPercent: 10,
          retentionPercent: 5,
          costCenterId: params.maps.costCenters.get('CC-NAC') ?? undefined,
        });
        summary.projects += 1;
      } catch (e) {
        logger.warn({ e, code }, 'Hazem seed: project skipped');
      }
    }
  }

  return summary;
}
