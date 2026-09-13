import type { DiagnosticProbeResult } from '../../ai/diagnostic/diagnostic.types';

export type GrowthRatingSnapshot = {
  potentialValue: number;
  breakdown: { revenue: number; cashRecovery: number; inventory: number; savings: number };
  counts: { open: number };
};

export function enrichDiagnosticProbesWithGrowth(
  probes: DiagnosticProbeResult[],
  snapshot: GrowthRatingSnapshot
): DiagnosticProbeResult[] {
  if (!snapshot.counts.open) return probes;
  const href = { label: 'فتح محرك النمو', href: '/growth' };

  return probes.map((probe) => {
    const findings = [...probe.findings];
    const actions = [...probe.actions];
    if (probe.key === 'sales' && snapshot.breakdown.cashRecovery >= 1) {
      findings.push(
        `محرك النمو: ${snapshot.breakdown.cashRecovery.toLocaleString('ar-EG')} ج.م مستحقات متأخرة محتملة، و${snapshot.breakdown.revenue.toLocaleString('ar-EG')} ج.م فرص إيراد.`
      );
      if (!actions.some((a) => a.href === '/growth')) actions.push(href);
    }
    if (probe.key === 'inventory' && snapshot.breakdown.inventory >= 1) {
      findings.push(
        `محرك النمو: ${snapshot.breakdown.inventory.toLocaleString('ar-EG')} ج.م رأس مال مربوط في مخزون بطيء أو راكد.`
      );
      if (!actions.some((a) => a.href === '/growth')) actions.push(href);
    }
    if (probe.key === 'financial' && snapshot.breakdown.savings >= 1) {
      findings.push(
        `محرك النمو: ${snapshot.breakdown.savings.toLocaleString('ar-EG')} ج.م فرص توفير أو استعادة هامش.`
      );
      if (!actions.some((a) => a.href === '/growth')) actions.push(href);
    }
    return { ...probe, findings, actions };
  });
}
