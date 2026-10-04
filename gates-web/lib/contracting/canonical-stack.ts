/** Matches `ContractingProjectStackPolicy` in Prisma. */
export type ContractingProjectStackPolicy = 'ENTERPRISE' | 'LEGACY_WAVE3';

export const ENTERPRISE_STACK_LABEL = 'Enterprise (مقايسة + مستخلص مالك / باطن)';

export const LEGACY_WAVE3_STACK_LABEL = 'Wave3 (أرشيف — ContractExtract)';

export function isEnterpriseStack(stack?: ContractingProjectStackPolicy | null): boolean {
  return (stack ?? 'ENTERPRISE') === 'ENTERPRISE';
}

export const ENTERPRISE_OWNER_CERT_PATH = 'client-billing';
export const ENTERPRISE_SUB_CERT_PATH = '/subcontracts/contracts';
