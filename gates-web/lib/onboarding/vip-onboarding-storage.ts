export type VipPersona = 'OWNER' | 'ACCOUNTANT' | 'CASHIER' | 'WAREHOUSE';

export type QuickWinKey = 'print-receipt' | 'inspect-masters' | 'ask-ai';

export type VipOnboardingRecord = {
  dismissed: boolean;
  sandbox: boolean;
  journeyActive: boolean;
  wins: Record<QuickWinKey, boolean>;
  dockMinimized: boolean;
};

const EMPTY: VipOnboardingRecord = {
  dismissed: false,
  sandbox: false,
  journeyActive: false,
  wins: { 'print-receipt': false, 'inspect-masters': false, 'ask-ai': false },
  dockMinimized: false,
};

export function vipStorageKey(userId: string, companyId: string) {
  return `gates:vip-onboarding:${companyId}:${userId}`;
}

export function readVipOnboarding(userId: string, companyId: string): VipOnboardingRecord {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem(vipStorageKey(userId, companyId));
    if (!raw) return { ...EMPTY, wins: { ...EMPTY.wins } };
    const parsed = JSON.parse(raw) as Partial<VipOnboardingRecord>;
    return {
      dismissed: Boolean(parsed.dismissed),
      sandbox: Boolean(parsed.sandbox),
      journeyActive: Boolean(parsed.journeyActive),
      dockMinimized: Boolean(parsed.dockMinimized),
      wins: {
        'print-receipt': Boolean(parsed.wins?.['print-receipt']),
        'inspect-masters': Boolean(parsed.wins?.['inspect-masters']),
        'ask-ai': Boolean(parsed.wins?.['ask-ai']),
      },
    };
  } catch {
    return { ...EMPTY, wins: { ...EMPTY.wins } };
  }
}

export const VIP_ONBOARDING_EVENT = 'gates-vip-onboarding';

export function writeVipOnboarding(
  userId: string,
  companyId: string,
  next: VipOnboardingRecord
) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(vipStorageKey(userId, companyId), JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(VIP_ONBOARDING_EVENT));
}

export function resolveVipPersona(roles: string[] | undefined): VipPersona {
  const normalized = (roles ?? []).map((role) => role.trim().toLowerCase());
  if (normalized.some((r) => r === 'cashier' || r === 'pos' || r === 'pos_cashier' || r === 'sales_user')) {
    return 'CASHIER';
  }
  if (
    normalized.some(
      (r) =>
        r === 'warehouse_keeper' ||
        r === 'warehouse' ||
        r === 'storekeeper' ||
        r === 'inventory_manager' ||
        r === 'inventory_viewer'
    )
  ) {
    return 'WAREHOUSE';
  }
  if (normalized.some((r) => r === 'accountant')) return 'ACCOUNTANT';
  return 'OWNER';
}

export const VIP_AI_PROMPT = 'ما هو موقف الخزينة ومبيعات اليوم؟';
