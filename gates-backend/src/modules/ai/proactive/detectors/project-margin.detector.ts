import { InsightCategory, InsightSeverity } from '@prisma/client';
import { isoDate, money, type AnomalyDetector, type DetectorFinding } from '../detector.types';

export type ProjectMarginSnapshot = {
  projectId: string;
  projectName: string;
  contractValue: number;
  estimatedCost: number;
  actualCost: number;
};

export type ProjectMarginPorts = {
  loadProjects: (companyId: string) => Promise<ProjectMarginSnapshot[]>;
};

const DROP_POINTS = 5;

export function marginPercent(contractValue: number, cost: number): number | null {
  if (contractValue <= 0) return null;
  return money(((contractValue - cost) / contractValue) * 100);
}

export function marginDropped(baseline: number | null, current: number | null): boolean {
  if (baseline == null || current == null) return false;
  return baseline - current > DROP_POINTS;
}

export class ProjectMarginDetector implements AnomalyDetector {
  readonly name = 'ProjectMarginDetector';

  constructor(private readonly ports: ProjectMarginPorts) {}

  async detect(ctx: { companyId: string; asOf: Date }): Promise<DetectorFinding[]> {
    const projects = await this.ports.loadProjects(ctx.companyId);
    const dropped = projects
      .map((project) => {
        const baseline = marginPercent(project.contractValue, project.estimatedCost);
        const current = marginPercent(project.contractValue, project.actualCost);
        const drop = baseline != null && current != null ? money(baseline - current) : 0;
        return { ...project, baselineMargin: baseline, currentMargin: current, dropPoints: drop };
      })
      .filter((row) => marginDropped(row.baselineMargin, row.currentMargin))
      .sort((a, b) => b.dropPoints - a.dropPoints);

    if (!dropped.length) return [];

    const worst = dropped[0];
    return [
      {
        category: InsightCategory.PROJECT_MARGIN_DROP,
        severity: worst.dropPoints >= 10 ? InsightSeverity.CRITICAL : InsightSeverity.WARNING,
        title: `تراجع هامش مشروع «${worst.projectName}» بأكثر من ${DROP_POINTS}%`,
        fallbackSummary: `الهامش الحالي ${worst.currentMargin}% مقابل أساس ${worst.baselineMargin}% (انخفاض ${worst.dropPoints} نقطة). راجع تكاليف المشروع قبل اعتماد مستخلصات إضافية.`,
        deterministicData: {
          asOf: isoDate(ctx.asOf),
          dropThresholdPoints: DROP_POINTS,
          projectCount: dropped.length,
          projects: dropped.slice(0, 10).map((row) => ({
            projectId: row.projectId,
            projectName: row.projectName,
            contractValue: money(row.contractValue),
            estimatedCost: money(row.estimatedCost),
            actualCost: money(row.actualCost),
            baselineMargin: row.baselineMargin,
            currentMargin: row.currentMargin,
            dropPoints: row.dropPoints,
          })),
        },
        actionLink: '/extracts/operations/projects',
        fingerprint: 'PROJECT_MARGIN_DROP:active',
      },
    ];
  }
}
