import { z } from 'zod';
import prisma from '../../../shared/database/prisma';
import { BaseAiTool } from './base-ai-tool';
import type { SupplierPayablesPort } from './get-supplier-payables.tool';
import { optionalUuid } from './shared-schemas';
import type { SecurityContext } from './types';

const paramsSchema = z.object({
  supplierId: optionalUuid,
  status: z.enum(['OVERDUE', 'UPCOMING']).optional(),
});

type Params = z.infer<typeof paramsSchema>;

export class VendorPayableTool extends BaseAiTool<Params> {
  readonly name = 'vendor_payable_tool';
  readonly description =
    'Accounts payable: total owed to vendors and upcoming/overdue purchase dues. Posted purchase invoices only.';
  readonly parameters = paramsSchema;
  readonly requiredPermission = 'invoice:view';
  readonly requiredPermissions = ['invoice:view', 'supplier:view', 'report:view'];

  constructor(private readonly aging: SupplierPayablesPort) {
    super();
  }

  protected async run(params: Params, context: SecurityContext) {
    const asOfDate = new Date();
    const in15 = new Date(asOfDate);
    in15.setDate(in15.getDate() + 15);
    const in30 = new Date(asOfDate);
    in30.setDate(in30.getDate() + 30);

    const [report, openPurchases] = await Promise.all([
      this.aging.getAgedPayables({
        companyId: context.companyId,
        branchId: context.branchId,
        asOfDate,
        supplierId: params.supplierId,
      }),
      prisma.invoice.findMany({
        where: {
          companyId: context.companyId,
          invoiceKind: { in: ['PURCHASE'] },
          isPosted: true,
          isCancelled: false,
          remainingAmount: { gt: 0 },
          ...(params.supplierId ? { supplierId: params.supplierId } : {}),
          ...(context.branchId ? { branchId: context.branchId } : {}),
        },
        select: {
          id: true,
          invoiceNumber: true,
          remainingAmount: true,
          dueDate: true,
          supplier: { select: { id: true, arabicName: true } },
        },
        take: 80,
      }),
    ]);

    const startOfToday = new Date(asOfDate.getFullYear(), asOfDate.getMonth(), asOfDate.getDate());
    const overdue = openPurchases.filter((row) => row.dueDate && row.dueDate < startOfToday);
    const upcoming15 = openPurchases.filter(
      (row) => row.dueDate && row.dueDate >= startOfToday && row.dueDate <= in15
    );
    const upcoming30 = openPurchases.filter(
      (row) => row.dueDate && row.dueDate >= startOfToday && row.dueDate <= in30
    );

    const mapDue = (rows: typeof openPurchases) =>
      rows.slice(0, 15).map((row) => ({
        invoiceId: row.id,
        invoiceNumber: row.invoiceNumber,
        supplierName: row.supplier?.arabicName ?? null,
        remaining: Number(row.remainingAmount),
        dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
      }));

    const status = params.status;
    return {
      asOfDate: asOfDate.toISOString().slice(0, 10),
      totalPayable: report.grandTotal,
      bucketTotals: report.bucketTotals,
      overdueDues: status === 'UPCOMING' ? [] : mapDue(overdue),
      upcoming15Days: status === 'OVERDUE' ? [] : mapDue(upcoming15),
      upcoming30Days: status === 'OVERDUE' ? [] : mapDue(upcoming30),
      suppliers: (report.parties ?? []).slice(0, 15).map((party) => ({
        supplierId: party.partyId,
        supplierName: party.partyName,
        total: party.total,
      })),
    };
  }
}
