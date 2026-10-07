import { AppError } from '../../../../shared/middleware/error-handler';

export type RuleGraphNode = {
  code: string;
  componentCode: string;
  phase: number;
  priority: number;
  dependsOn: string[];
};

/** Topological order within phases; detect cycles on component-code dependencies. */
export function orderPayrollRules(nodes: RuleGraphNode[]): RuleGraphNode[] {
  const byCode = new Map(nodes.map((n) => [n.code, n]));
  const componentDeps = new Map<string, string[]>();
  for (const n of nodes) {
    const deps = new Set<string>();
    for (const d of n.dependsOn) {
      const depNode = byCode.get(d);
      if (!depNode) {
        throw new AppError(422, `Rule ${n.code} depends on missing rule ${d}`);
      }
      deps.add(depNode.componentCode);
    }
    for (const c of n.dependsOn) {
      const depNode = byCode.get(c);
      if (depNode) deps.add(depNode.componentCode);
    }
    componentDeps.set(n.componentCode, [...deps]);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  const visitComponent = (comp: string) => {
    if (visited.has(comp)) return;
    if (visiting.has(comp)) {
      throw new AppError(422, `Payroll rule dependency cycle involving component ${comp}`);
    }
    visiting.add(comp);
    for (const d of componentDeps.get(comp) ?? []) visitComponent(d);
    visiting.delete(comp);
    visited.add(comp);
    stack.push(comp);
  };

  const phases = [...new Set(nodes.map((n) => n.phase))].sort((a, b) => a - b);
  const ordered: RuleGraphNode[] = [];
  for (const phase of phases) {
    const phaseNodes = nodes
      .filter((n) => n.phase === phase)
      .sort((a, b) => a.priority - b.priority || a.code.localeCompare(b.code));
    for (const n of phaseNodes) visitComponent(n.componentCode);
    const phaseOrder = new Map<string, number>();
    stack.forEach((c, i) => phaseOrder.set(c, i));
    phaseNodes.sort(
      (a, b) =>
        (phaseOrder.get(a.componentCode) ?? 0) - (phaseOrder.get(b.componentCode) ?? 0) ||
        a.priority - b.priority
    );
    ordered.push(...phaseNodes);
  }
  return ordered;
}
