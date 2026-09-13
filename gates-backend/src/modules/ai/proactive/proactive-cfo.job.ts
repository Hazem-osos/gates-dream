import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import type { AIProvider } from '../interfaces/ai-provider';
import { OpenAIProvider } from '../providers/openai.provider';
import type { AnomalyDetector, DetectorFinding } from './detector.types';
import { prismaCashFlowPorts } from './detector-ports.prisma';
import { prismaProjectMarginPorts } from './detector-ports.prisma';
import { prismaReceivablesPorts } from './detector-ports.prisma';
import { prismaStockRunoutPorts } from './detector-ports.prisma';
import { CashFlowRiskDetector } from './detectors/cash-flow-risk.detector';
import { ProjectMarginDetector } from './detectors/project-margin.detector';
import { ReceivablesRiskDetector } from './detectors/receivables-risk.detector';
import { StockRunoutDetector } from './detectors/stock-runout.detector';
import { insightStore, type InsightStore } from './insight.store';
import { synthesizeInsightSummaries } from './synthesize-insights';

export type ProactiveScanResult = {
  companyId: string;
  findings: number;
  saved: number;
  expired: number;
};

export class ProactiveCfoJob {
  constructor(
    private readonly detectors: AnomalyDetector[],
    private readonly store: InsightStore,
    private readonly provider: AIProvider
  ) {}

  async runForCompany(companyId: string, asOf = new Date()): Promise<ProactiveScanResult> {
    const expired = await this.store.expireStale(companyId, asOf);
    const findings: DetectorFinding[] = [];
    for (const detector of this.detectors) {
      try {
        findings.push(...(await detector.detect({ companyId, asOf })));
      } catch (error) {
        logger.warn({ error, companyId, detector: detector.name }, 'CFO detector failed');
      }
    }
    const synthesized = await synthesizeInsightSummaries(this.provider, findings);
    const saved = await this.store.persistFindings(companyId, synthesized, asOf);
    try {
      const { sentinelService } = await import('../sentinel/sentinel.instance');
      await sentinelService.runScheduledScan(companyId, asOf);
    } catch (error) {
      logger.warn({ error, companyId }, 'Sentinel scheduled scan failed');
    }
    try {
      const { aiSentinelService } = await import('../sentinel/ai-sentinel.instance');
      await aiSentinelService.runForCompany(companyId, asOf);
    } catch (error) {
      logger.warn({ error, companyId }, 'RBAC AI sentinel scan failed');
    }
    return { companyId, findings: findings.length, saved: saved.length, expired };
  }

  async runAllActiveCompanies(asOf = new Date()): Promise<{
    asOf: string;
    tenants: number;
    results: ProactiveScanResult[];
  }> {
    const companies = await prisma.company.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true },
    });
    const results: ProactiveScanResult[] = [];
    for (const company of companies) {
      try {
        results.push(await this.runForCompany(company.id, asOf));
      } catch (error) {
        logger.error({ error, companyId: company.id }, 'Proactive CFO scan failed for tenant');
      }
    }
    return { asOf: asOf.toISOString(), tenants: companies.length, results };
  }
}

export function createDefaultDetectors(): AnomalyDetector[] {
  return [
    new CashFlowRiskDetector(prismaCashFlowPorts),
    new ReceivablesRiskDetector(prismaReceivablesPorts),
    new StockRunoutDetector(prismaStockRunoutPorts),
    new ProjectMarginDetector(prismaProjectMarginPorts),
  ];
}

export const proactiveCfoJob = new ProactiveCfoJob(
  createDefaultDetectors(),
  insightStore,
  new OpenAIProvider()
);
