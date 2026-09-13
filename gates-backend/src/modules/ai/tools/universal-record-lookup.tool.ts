import { z } from 'zod';
import prisma from '../../../shared/database/prisma';
import { AI_TOOL_PERMISSION_DENIED_AR, hasGrantedPermission } from './ai-tool-access';
import { BaseAiTool } from './base-ai-tool';
import type { SecurityContext } from './types';

const paramsSchema = z.object({
  recordType: z.enum(['INVOICE', 'VOUCHER', 'ITEM', 'CUSTOMER']),
  identifier: z.string().trim().min(1).max(120),
});

type Params = z.infer<typeof paramsSchema>;

const TYPE_PERMISSION: Record<Params['recordType'], string> = {
  INVOICE: 'invoice:view',
  VOUCHER: 'journal-entry:view',
  ITEM: 'item:view',
  CUSTOMER: 'customer:view',
};

export class UniversalRecordLookupTool extends BaseAiTool<Params> {
  readonly name = 'universal_record_lookup';
  readonly description =
    'Look up a company-scoped invoice, voucher, item, or customer by number, phone, or name. Returns a short summary only.';
  readonly parameters = paramsSchema;
  readonly requiredPermission = '';

  protected async run(params: Params, context: SecurityContext) {
    const needed = TYPE_PERMISSION[params.recordType];
    if (needed && !hasGrantedPermission(context, needed) && !hasGrantedPermission(context, 'report:view')) {
      return { error: AI_TOOL_PERMISSION_DENIED_AR };
    }

    const q = params.identifier.trim();
    const companyId = context.companyId;

    if (params.recordType === 'INVOICE') {
      const rows = await prisma.invoice.findMany({
        where: {
          companyId,
          OR: [
            { invoiceNumber: { contains: q } },
            { customer: { arabicName: { contains: q } } },
            { supplier: { arabicName: { contains: q } } },
          ],
        },
        select: {
          id: true,
          invoiceNumber: true,
          invoiceKind: true,
          date: true,
          isPosted: true,
          netAmount: true,
          remainingAmount: true,
          customer: { select: { arabicName: true } },
          supplier: { select: { arabicName: true } },
        },
        take: 8,
        orderBy: { date: 'desc' },
      });
      return {
        recordType: 'INVOICE',
        matches: rows.map((row) => ({
          id: row.id,
          number: row.invoiceNumber,
          kind: row.invoiceKind,
          date: row.date.toISOString().slice(0, 10),
          posted: row.isPosted,
          total: Number(row.netAmount),
          remaining: Number(row.remainingAmount),
          party: row.customer?.arabicName ?? row.supplier?.arabicName ?? null,
        })),
      };
    }

    if (params.recordType === 'VOUCHER') {
      const rows = await prisma.cashTransaction.findMany({
        where: {
          companyId,
          isCancelled: false,
          OR: [
            { voucherNumber: { contains: q } },
            { description: { contains: q } },
            { bankReference: { contains: q } },
          ],
        },
        select: {
          id: true,
          voucherNumber: true,
          transactionKind: true,
          date: true,
          amount: true,
          isPosted: true,
          description: true,
        },
        take: 8,
        orderBy: { date: 'desc' },
      });
      return {
        recordType: 'VOUCHER',
        matches: rows.map((row) => ({
          id: row.id,
          number: row.voucherNumber,
          kind: row.transactionKind,
          date: row.date.toISOString().slice(0, 10),
          amount: Number(row.amount),
          posted: row.isPosted,
          description: row.description,
        })),
      };
    }

    if (params.recordType === 'ITEM') {
      const rows = await prisma.item.findMany({
        where: {
          companyId,
          OR: [
            { arabicName: { contains: q } },
            { englishName: { contains: q } },
            { barcode: { contains: q } },
            { serial: { contains: q } },
          ],
        },
        select: { id: true, serial: true, arabicName: true, priceRetail: true, isActive: true },
        take: 8,
      });
      return {
        recordType: 'ITEM',
        matches: rows.map((row) => ({
          id: row.id,
          code: row.serial,
          name: row.arabicName,
          salesPrice: Number(row.priceRetail),
          active: row.isActive,
        })),
      };
    }

    const rows = await prisma.customer.findMany({
      where: {
        companyId,
        OR: [
          { arabicName: { contains: q } },
          { englishName: { contains: q } },
          { code: { contains: q } },
          { mobile: { contains: q } },
          { phone1: { contains: q } },
        ],
      },
      select: { id: true, code: true, arabicName: true, mobile: true, phone1: true },
      take: 8,
    });
    return {
      recordType: 'CUSTOMER',
      matches: rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.arabicName,
        phone: row.mobile ?? row.phone1,
      })),
    };
  }
}
