export const GATES_ESIGN_PROTOCOL_VERSION = 2;

export function compareSemver(left: string, right: string): number {
  const parse = (value: string) =>
    value
      .split('.')
      .slice(0, 3)
      .map((part) => Number.parseInt(part.replace(/\D.*/, ''), 10) || 0);
  const a = parse(left);
  const b = parse(right);
  for (let i = 0; i < 3; i += 1) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0);
  }
  return 0;
}

export function isProtocolCompatible(agentProtocol: number, required = GATES_ESIGN_PROTOCOL_VERSION): boolean {
  return agentProtocol === required;
}

export function needsAgentUpdate(agentVersion: string, minimumVersion: string): boolean {
  return compareSemver(agentVersion, minimumVersion) < 0;
}
