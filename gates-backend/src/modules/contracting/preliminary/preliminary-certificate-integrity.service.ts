import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { money, sumMoney } from '../utils/money-decimal';
import { ownerPreliminaryCertificateCalculationService } from './owner-preliminary-certificate-calculation.service';
import { subcontractPreliminaryCertificateCalculationService } from './subcontract-preliminary-certificate-calculation.service';

export type IntegrityVerdict = 'MATCH' | 'MISMATCH';

export type PreliminaryIntegrityCheck = {
  code: string;
  verdict: IntegrityVerdict;
  expected?: string;
  actual?: string;
};

export type PreliminaryIntegrityReport = {
  certificateId: string;
  side: 'OWNER' | 'SUBCONTRACTOR';
  overall: IntegrityVerdict;
  checks: PreliminaryIntegrityCheck[];
};

const MONEY_TOL = 0.02;

function closeEnough(a: number, b: number, tol = MONEY_TOL) {
  return Math.abs(a - b) <= tol;
}

function verdict(checks: PreliminaryIntegrityCheck[]): IntegrityVerdict {
  return checks.every((c) => c.verdict === 'MATCH') ? 'MATCH' : 'MISMATCH';
}

function checkMoney(code: string, expected: number, actual: number): PreliminaryIntegrityCheck {
  return {
    code,
    verdict: closeEnough(expected, actual) ? 'MATCH' : 'MISMATCH',
    expected: expected.toFixed(4),
    actual: actual.toFixed(4),
  };
}

export class PreliminaryCertificateIntegrityService {
  async checkOwner(companyId: string, certificateId: string): Promise<PreliminaryIntegrityReport> {
    const cert = await prisma.ownerPreliminaryCertificate.findFirst({
      where: { id: certificateId, companyId },
      include: { lines: true, clientInvoice: { include: { items: true } } },
    });
    if (!cert) throw new AppError(404, 'المستخلص الابتدائي غير موجود');

    const checks: PreliminaryIntegrityCheck[] = [];

    const sumCurrent = sumMoney(cert.lines.map((l) => money(l.currentAmount)));
    const sumCumulative = sumMoney(cert.lines.map((l) => money(l.cumulativeAmount)));
    checks.push(
      checkMoney('HEADER_GROSS_CURRENT', Number(cert.grossCurrentWorks), Number(sumCurrent))
    );
    checks.push(
      checkMoney('HEADER_CUMULATIVE_GROSS', Number(cert.cumulativeGrossWorks), Number(sumCumulative))
    );

    const recalc = await prisma.$transaction((tx) =>
      ownerPreliminaryCertificateCalculationService.calculateInTx(
        tx,
        companyId,
        cert.clientContractId,
        {
          lines: cert.lines.map((line) => ({
            projectBOQItemId: line.projectBOQItemId,
            requestedCurrentQuantity: Number(line.requestedCurrentQuantity),
            approvedCurrentQuantity:
              line.approvedCurrentQuantity != null
                ? Number(line.approvedCurrentQuantity)
                : undefined,
          })),
          otherClientPenalties: Number(cert.otherClientPenalties),
          excludePreliminaryCertificateId: cert.id,
          useApprovedQuantities: cert.status === 'APPROVED' || cert.status === 'CONVERTED',
        }
      )
    );

    checks.push(
      checkMoney('RECALC_NET_PAYABLE', Number(cert.netPayablePreview), Number(recalc.netPayablePreview))
    );
    checks.push(
      checkMoney('RECALC_GROSS_CURRENT', Number(cert.grossCurrentWorks), Number(recalc.grossCurrentWorks))
    );

    if (cert.status === 'CONVERTED' && cert.clientInvoice) {
      for (const line of cert.lines) {
        const invItem = cert.clientInvoice.items.find((i) => i.projectBOQItemId === line.projectBOQItemId);
        const approved = line.approvedCurrentQuantity ?? line.requestedCurrentQuantity;
        checks.push({
          code: `CONVERTED_QTY_${line.projectBOQItemId}`,
          verdict:
            invItem && closeEnough(Number(invItem.currentQuantity), Number(approved))
              ? 'MATCH'
              : 'MISMATCH',
          expected: Number(approved).toFixed(4),
          actual: invItem ? Number(invItem.currentQuantity).toFixed(4) : 'MISSING',
        });
      }
    }

    return {
      certificateId,
      side: 'OWNER',
      overall: verdict(checks),
      checks,
    };
  }

  async checkSubcontract(companyId: string, certificateId: string): Promise<PreliminaryIntegrityReport> {
    const cert = await prisma.subcontractPreliminaryCertificate.findFirst({
      where: { id: certificateId, companyId },
      include: { lines: true, subcontractInvoice: { include: { items: true } } },
    });
    if (!cert) throw new AppError(404, 'المستخلص الابتدائي غير موجود');

    const checks: PreliminaryIntegrityCheck[] = [];

    const sumCurrent = sumMoney(cert.lines.map((l) => money(l.currentAmount)));
    const sumCumulative = sumMoney(cert.lines.map((l) => money(l.cumulativeAmount)));
    checks.push(
      checkMoney('HEADER_GROSS_CURRENT', Number(cert.grossCurrentAmount), Number(sumCurrent))
    );
    checks.push(
      checkMoney('HEADER_CUMULATIVE_GROSS', Number(cert.grossCumulativeAmount), Number(sumCumulative))
    );

    const recalc = await prisma.$transaction((tx) =>
      subcontractPreliminaryCertificateCalculationService.calculateInTx(
        tx,
        companyId,
        cert.subcontractId,
        {
          lines: cert.lines.map((line) => ({
            subcontractBOQItemId: line.subcontractBOQItemId,
            requestedCurrentQuantity: Number(line.requestedCurrentQuantity),
            approvedCurrentQuantity:
              line.approvedCurrentQuantity != null
                ? Number(line.approvedCurrentQuantity)
                : undefined,
          })),
          applyEarlyPaymentDiscount: cert.earlyPaymentDiscountDeduction.gt(0),
          excludePreliminaryCertificateId: cert.id,
          useApprovedQuantities: cert.status === 'APPROVED' || cert.status === 'CONVERTED',
        }
      )
    );

    checks.push(
      checkMoney('RECALC_NET_PAYABLE', Number(cert.netPayablePreview), Number(recalc.netPayablePreview))
    );
    checks.push(
      checkMoney('RECALC_GROSS_CURRENT', Number(cert.grossCurrentAmount), Number(recalc.grossCurrentAmount))
    );

    if (cert.status === 'CONVERTED' && cert.subcontractInvoice) {
      for (const line of cert.lines) {
        const invItem = cert.subcontractInvoice.items.find(
          (i) => i.subcontractBOQItemId === line.subcontractBOQItemId
        );
        const approved = line.approvedCurrentQuantity ?? line.requestedCurrentQuantity;
        checks.push({
          code: `CONVERTED_QTY_${line.subcontractBOQItemId}`,
          verdict:
            invItem && closeEnough(Number(invItem.currentQuantity), Number(approved))
              ? 'MATCH'
              : 'MISMATCH',
          expected: Number(approved).toFixed(4),
          actual: invItem ? Number(invItem.currentQuantity).toFixed(4) : 'MISSING',
        });
      }
    }

    return {
      certificateId,
      side: 'SUBCONTRACTOR',
      overall: verdict(checks),
      checks,
    };
  }
}

export const preliminaryCertificateIntegrityService = new PreliminaryCertificateIntegrityService();
