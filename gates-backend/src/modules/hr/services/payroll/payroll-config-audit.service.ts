import prisma from '../../../../shared/database/prisma';

export type PayrollConfigAuditSubject =
  | 'HCM_PAYROLL_RULE'
  | 'HCM_PAYROLL_LOCALIZATION'
  | 'HCM_PAYROLL_GL_MAPPING';

export class PayrollConfigAuditService {
  async record(params: {
    companyId: string;
    subjectType: PayrollConfigAuditSubject;
    subjectId: string;
    actorId: string;
    action: 'CREATED' | 'UPDATED';
    summary: string;
    effectiveFrom?: string;
    effectiveTo?: string | null;
    entityCode?: string;
  }) {
    await prisma.activityLog.create({
      data: {
        tenantId: params.companyId,
        actorId: params.actorId,
        kind: 'payroll-config-audit',
        subjectType: params.subjectType,
        subjectId: params.subjectId,
        severity: 'info',
        reason: params.summary,
        metadata: {
          action: params.action,
          effectiveFrom: params.effectiveFrom ?? null,
          effectiveTo: params.effectiveTo ?? null,
          entityCode: params.entityCode ?? null,
        },
      },
    });
  }

  async list(
    companyId: string,
    subjectType: PayrollConfigAuditSubject,
    opts?: { subjectId?: string; limit?: number }
  ) {
    const limit = Math.min(100, Math.max(1, opts?.limit ?? 50));
    const rows = await prisma.activityLog.findMany({
      where: {
        tenantId: companyId,
        kind: 'payroll-config-audit',
        subjectType,
        ...(opts?.subjectId ? { subjectId: opts.subjectId } : {}),
      },
      orderBy: { at: 'desc' },
      take: limit,
    });
    return rows.map((r) => {
      const meta = (r.metadata ?? {}) as Record<string, unknown>;
      return {
        id: r.id,
        at: r.at,
        actorId: r.actorId,
        subjectId: r.subjectId,
        action: meta.action as string,
        summary: r.reason,
        effectiveFrom: meta.effectiveFrom as string | null,
        effectiveTo: meta.effectiveTo as string | null,
        entityCode: meta.entityCode as string | null,
      };
    });
  }
}

export const payrollConfigAuditService = new PayrollConfigAuditService();
