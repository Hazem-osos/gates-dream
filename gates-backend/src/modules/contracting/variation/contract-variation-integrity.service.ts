import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { money, sumMoney } from '../utils/money-decimal';
import {
  loadApprovedOwnerVariationLinesInTx,
  resolveEffectiveOwnerBoqQuantityFromBase,
  resolveEffectiveOwnerBoqRateFromLines,
} from './contract-variation-effective.service';

export type VariationIntegrityVerdict = 'MATCH' | 'MISMATCH';

export type VariationIntegrityCheck = {
  code: string;
  verdict: VariationIntegrityVerdict;
  expected?: string;
  actual?: string;
  projectBOQItemId?: string;
  itemCode?: string;
};

export type ContractVariationIntegrityReport = {
  clientContractId: string;
  overall: VariationIntegrityVerdict;
  checks: VariationIntegrityCheck[];
};

const MONEY_TOL = 0.02;

function closeEnough(a: number, b: number, tol = MONEY_TOL) {
  return Math.abs(a - b) <= tol;
}

function verdict(checks: VariationIntegrityCheck[]): VariationIntegrityVerdict {
  return checks.every((c) => c.verdict === 'MATCH') ? 'MATCH' : 'MISMATCH';
}

export class ContractVariationIntegrityService {
  async reconcileContract(companyId: string, clientContractId: string): Promise<ContractVariationIntegrityReport> {
    const contract = await prisma.clientContract.findFirst({
      where: { id: clientContractId, companyId },
    });
    if (!contract) throw new AppError(404, 'عقد المالك غير موجود');

    const checks: VariationIntegrityCheck[] = [];
    const approvedOrders = await prisma.contractVariationOrder.findMany({
      where: { companyId, clientContractId, status: 'APPROVED' },
      include: { lines: true },
      orderBy: { sequenceNumber: 'asc' },
    });

    const sumHeaderNet = sumMoney(approvedOrders.map((o) => money(o.netImpact)));
    const sumLineNet = sumMoney(
      approvedOrders.flatMap((o) => o.lines.map((l) => money(l.amountImpact)))
    );
    checks.push({
      code: 'APPROVED_NET_IMPACT',
      verdict: closeEnough(Number(sumHeaderNet), Number(sumLineNet)) ? 'MATCH' : 'MISMATCH',
      expected: Number(sumHeaderNet).toFixed(4),
      actual: Number(sumLineNet).toFixed(4),
    });

    const original = money(contract.totalContractValue);
    const expectedRevised = money(original.plus(sumHeaderNet));
    const lastApproved = approvedOrders[approvedOrders.length - 1];
    if (lastApproved) {
      checks.push({
        code: 'REVISED_VALUE_SNAPSHOT',
        verdict: closeEnough(Number(expectedRevised), Number(lastApproved.revisedContractValueSnapshot))
          ? 'MATCH'
          : 'MISMATCH',
        expected: Number(expectedRevised).toFixed(4),
        actual: Number(lastApproved.revisedContractValueSnapshot).toFixed(4),
      });
    }

    const boqItems = await prisma.projectBOQItem.findMany({
      where: { companyId, projectId: contract.projectId },
    });

    const approvedLines = await loadApprovedOwnerVariationLinesInTx(prisma, companyId, clientContractId);

    const latestQtyByBoq = new Map<string, string>();
    for (const order of approvedOrders) {
      for (const line of order.lines) {
        if (!line.projectBOQItemId || line.effectiveQuantityAfter == null) continue;
        latestQtyByBoq.set(line.projectBOQItemId, line.effectiveQuantityAfter.toFixed(4));
      }
    }

    for (const boq of boqItems) {
      const expectedQty = resolveEffectiveOwnerBoqQuantityFromBase(
        money(boq.contractQuantity),
        approvedLines,
        boq.id
      );
      const expectedRate = resolveEffectiveOwnerBoqRateFromLines(
        money(boq.unitSellingPrice),
        approvedLines,
        boq.id
      );

      const storedEffective = latestQtyByBoq.get(boq.id);
      const qtyMatches =
        storedEffective == null || closeEnough(Number(storedEffective), Number(expectedQty));
      checks.push({
        code: qtyMatches ? 'EFFECTIVE_QTY_MATCH' : 'EFFECTIVE_QTY_MISMATCH',
        verdict: qtyMatches ? 'MATCH' : 'MISMATCH',
        expected: expectedQty.toFixed(4),
        actual: storedEffective ?? expectedQty.toFixed(4),
        projectBOQItemId: boq.id,
        itemCode: boq.itemCode,
      });

      const storedRate = money(boq.unitSellingPrice);
      if (boq.origin === 'VARIATION_ORDER') {
        const rateMatches = closeEnough(Number(storedRate), Number(expectedRate));
        checks.push({
          code: rateMatches ? 'EFFECTIVE_RATE_MATCH' : 'INVALID_RATE_HISTORY',
          verdict: rateMatches ? 'MATCH' : 'MISMATCH',
          expected: expectedRate.toFixed(4),
          actual: storedRate.toFixed(4),
          projectBOQItemId: boq.id,
          itemCode: boq.itemCode,
        });
      }

      if (boq.origin === 'VARIATION_ORDER' && boq.sourceVariationOrderId) {
        const source = approvedOrders.find((o) => o.id === boq.sourceVariationOrderId);
        checks.push({
          code: 'NEW_ITEM_SOURCE_APPROVED',
          verdict: source ? 'MATCH' : 'MISMATCH',
          projectBOQItemId: boq.id,
          itemCode: boq.itemCode,
        });
      }
    }

    for (const order of approvedOrders) {
      const lineSum = sumMoney(order.lines.map((l) => money(l.amountImpact)));
      checks.push({
        code: `ORDER_${order.orderNumber}_LINE_AMOUNT`,
        verdict: closeEnough(Number(order.netImpact), Number(lineSum)) ? 'MATCH' : 'MISMATCH',
        expected: Number(order.netImpact).toFixed(4),
        actual: Number(lineSum).toFixed(4),
      });
    }

    return {
      clientContractId,
      overall: verdict(checks),
      checks,
    };
  }
}

export const contractVariationIntegrityService = new ContractVariationIntegrityService();
