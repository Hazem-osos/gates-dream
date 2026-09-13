import { logger } from '../../../shared/logger';
import type { AIProvider } from '../interfaces/ai-provider';
import { addDays, isoDate } from '../sentinel/sentinel.math';
import { money } from './diagnostic.math';
import {
  healthStatus,
  healthStatusLabel,
  moduleTag,
  resolveActiveProbes,
  skippedReason,
  weightedHealthScore,
} from './diagnostic.math';
import type { DiagnosticPorts } from './diagnostic.ports';
import {
  evaluateContracting,
  evaluateFinancial,
  evaluateHr,
  evaluateInventory,
  evaluateManufacturing,
  evaluateRealEstate,
  evaluateSales,
} from './diagnostic.probes';
import { synthesizeDiagnosticNarrative, toCompactDiagnostic } from './synthesize-diagnostic';
import { growthEngineService } from '../../growth/services/growth-engine.service';
import { enrichDiagnosticProbesWithGrowth } from '../../growth/services/growth-rating';
import {
  DIAGNOSTIC_NARRATIVE_MODEL,
  type DiagnosticProbeKey,
  type DiagnosticProbeResult,
  type DiagnosticReport,
} from './diagnostic.types';

export class DiagnosticService {
  constructor(
    private readonly ports: DiagnosticPorts,
    private readonly provider: AIProvider
  ) {}

  async buildReport(companyId: string, asOf = new Date()): Promise<DiagnosticReport> {
    const license = await this.ports.getCurrent(companyId);
    const { active, skipped } = resolveActiveProbes(license);
    const from30 = addDays(asOf, -30);
    const from60 = addDays(asOf, -60);
    const from90 = addDays(asOf, -90);

    let probes: DiagnosticProbeResult[] = [];
    for (const key of active) {
      try {
        probes.push(await this.runProbe(key, companyId, asOf, from30, from60, from90));
      } catch (error) {
        logger.warn({ error, companyId, key }, 'Diagnostic probe failed');
      }
    }

    try {
      const growth = await growthEngineService.getOverview(companyId);
      probes = enrichDiagnosticProbesWithGrowth(probes, {
        potentialValue: growth.potentialValue,
        breakdown: growth.breakdown,
        counts: { open: growth.counts.open },
      });
    } catch (error) {
      logger.warn({ error, companyId }, 'Growth rating enrichment skipped');
    }

    const companyHealthScore = weightedHealthScore(probes);
    const status = healthStatus(companyHealthScore);
    const statusLabel = healthStatusLabel(companyHealthScore);
    const evaluatedModules = probes.map((probe) => moduleTag(probe.key));

    const draft: Pick<
      DiagnosticReport,
      'asOf' | 'companyHealthScore' | 'statusLabel' | 'evaluatedModules' | 'probes'
    > = {
      asOf: isoDate(asOf),
      companyHealthScore,
      statusLabel,
      evaluatedModules,
      probes,
    };
    const synthesized = await synthesizeDiagnosticNarrative(this.provider, toCompactDiagnostic(draft));

    return {
      generatedAt: asOf.toISOString(),
      asOf: isoDate(asOf),
      companyHealthScore,
      status,
      statusLabel,
      evaluatedModules,
      skippedModules: skipped.map((key) => ({ ...moduleTag(key), reason: skippedReason(key) })),
      unrestricted: license.unrestricted,
      allowedModules: license.allowedModules,
      probes,
      briefing: synthesized.briefing,
      decisions: synthesized.decisions,
      narrativeSource: synthesized.source,
      model: synthesized.model || DIAGNOSTIC_NARRATIVE_MODEL,
    };
  }

  private async runProbe(
    key: DiagnosticProbeKey,
    companyId: string,
    asOf: Date,
    from30: Date,
    from60: Date,
    from90: Date
  ): Promise<DiagnosticProbeResult> {
    switch (key) {
      case 'financial': {
        const [cash, sales30, purchases30, ar, payables, inventoryValue] = await Promise.all([
          this.ports.liquidCash(companyId),
          this.ports.periodSales(companyId, from30, asOf),
          this.ports.periodPurchases(companyId, from30, asOf),
          this.ports.openReceivables(companyId, asOf),
          this.ports.openPayables(companyId),
          this.ports.inventoryValue(companyId),
        ]);
        return evaluateFinancial({
          liquid: money(cash.treasuryTotal + cash.bankTotal),
          sales30,
          purchases30,
          receivables: ar.total,
          payables,
          inventoryValue,
        });
      }
      case 'sales': {
        const [customers, ar, sales90] = await Promise.all([
          this.ports.customerRevenue(companyId, from90, asOf),
          this.ports.openReceivables(companyId, asOf),
          this.ports.periodSales(companyId, from90, asOf),
        ]);
        return evaluateSales({
          customers,
          receivables: ar.total,
          overdue: ar.overdue,
          overdue90: ar.overdue90,
          sales90,
        });
      }
      case 'inventory': {
        const [items, cogs90, inventoryValue, belowReplacement] = await Promise.all([
          this.ports.stockItems(companyId),
          this.ports.cogs(companyId, from90, asOf),
          this.ports.inventoryValue(companyId),
          this.ports.belowReplacementSales(companyId, from60),
        ]);
        return evaluateInventory({ items, cogs90, inventoryValue, belowReplacement, asOf });
      }
      case 'contracting': {
        const [projects, cash] = await Promise.all([
          this.ports.contractingProjects(companyId, asOf, 21),
          this.ports.liquidCash(companyId),
        ]);
        return evaluateContracting({
          projects,
          liquid: money(cash.treasuryTotal + cash.bankTotal),
        });
      }
      case 'manufacturing':
        return evaluateManufacturing(await this.ports.production(companyId, from90));
      case 'real-estate':
        return evaluateRealEstate(await this.ports.realEstate(companyId, asOf));
      case 'hr': {
        const [payroll, sales30] = await Promise.all([
          this.ports.latestPayroll(companyId),
          this.ports.periodSales(companyId, from30, asOf),
        ]);
        return evaluateHr({ payroll, sales30 });
      }
      default:
        throw new Error(`Unknown probe ${key as string}`);
    }
  }
}
