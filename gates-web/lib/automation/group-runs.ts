import type { AutomationRun } from './types';

export type AutomationRunGroup = {
  key: string;
  eventId: string;
  ruleId: string;
  eventType: string | null;
  ruleName: string | null;
  startedAt: string;
  runs: AutomationRun[];
};

/** One business execution is every action row that shares eventId + ruleId. */
export function groupAutomationRuns(runs: AutomationRun[]): AutomationRunGroup[] {
  const groups = new Map<string, AutomationRunGroup>();
  for (const run of runs) {
    const key = `${run.eventId}::${run.ruleId}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        key,
        eventId: run.eventId,
        ruleId: run.ruleId,
        eventType: run.eventType,
        ruleName: run.ruleName,
        startedAt: run.startedAt,
        runs: [run],
      });
      continue;
    }
    existing.runs.push(run);
    if (run.startedAt < existing.startedAt) existing.startedAt = run.startedAt;
    if (!existing.eventType && run.eventType) existing.eventType = run.eventType;
    if (!existing.ruleName && run.ruleName) existing.ruleName = run.ruleName;
  }

  const list = [...groups.values()];
  for (const group of list) {
    group.runs.sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id));
  }
  list.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return list;
}
