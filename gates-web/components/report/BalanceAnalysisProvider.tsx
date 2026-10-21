'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Eye } from 'lucide-react';
import { AccountLedgerDrawer } from '@/components/accounting/chart-of-accounts/AccountLedgerDrawer';
import {
  isSyntheticLedgerAccountId,
  ledgerFilterParams,
} from '@/lib/reportEngine/reportRowHref';

export type BalanceAnalysisKind = 'account' | 'costCenter';

export type BalanceAnalysisTarget = {
  accountId: string;
  label: string;
  kind?: BalanceAnalysisKind;
  query?: Record<string, string>;
};

type BalanceAnalysisContextValue = {
  open: (target: BalanceAnalysisTarget) => void;
};

const BalanceAnalysisContext = createContext<BalanceAnalysisContextValue | null>(null);

export function useBalanceAnalysisOptional() {
  return useContext(BalanceAnalysisContext);
}

export function BalanceAnalysisProvider({
  children,
  query,
}: {
  children: ReactNode;
  query?: Record<string, string>;
}) {
  const [target, setTarget] = useState<BalanceAnalysisTarget | null>(null);
  const open = useCallback((next: BalanceAnalysisTarget) => {
    if (isSyntheticLedgerAccountId(next.accountId)) return;
    setTarget(next);
  }, []);
  const merged = useMemo(
    () => ({ ...(query ?? {}), ...(target?.query ?? {}) }),
    [query, target]
  );
  const period = ledgerFilterParams(merged);
  const value = useMemo(() => ({ open }), [open]);

  return (
    <BalanceAnalysisContext.Provider value={value}>
      {children}
      <AccountLedgerDrawer
        open={Boolean(target)}
        accountId={target?.accountId ?? null}
        accountLabel={target?.label ?? ''}
        kind={target?.kind ?? 'account'}
        fromDate={period.get('fromDate') ?? undefined}
        toDate={period.get('toDate') ?? undefined}
        query={merged}
        heading="تفسير تحليلي للرصيد"
        onClose={() => setTarget(null)}
      />
    </BalanceAnalysisContext.Provider>
  );
}

export function BalanceRowEye({
  accountId,
  label,
  query,
  kind = 'account',
}: {
  accountId?: string | null;
  label?: string;
  query?: Record<string, string>;
  kind?: BalanceAnalysisKind;
}) {
  const analysis = useBalanceAnalysisOptional();
  if (!analysis || isSyntheticLedgerAccountId(accountId)) {
    return <span className="inline-block w-7 no-print" />;
  }
  return (
    <button
      type="button"
      title="تفسير تحليلي للرصيد"
      aria-label="تفسير تحليلي للرصيد"
      className="no-print inline-flex h-7 w-7 items-center justify-center rounded-md text-[#0E78AA] hover:bg-[#0E78AA]/10"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        analysis.open({
          accountId: accountId as string,
          label: label?.trim() || 'الحساب',
          kind,
          query,
        });
      }}
    >
      <Eye className="h-4 w-4" />
    </button>
  );
}

export function balanceRowLabel(row: Record<string, unknown>): string {
  const code = typeof row.code === 'string' ? row.code.trim() : '';
  const name =
    (typeof row.arabicName === 'string' && row.arabicName.trim()) ||
    (typeof row.account === 'string' && row.account.trim()) ||
    '';
  return [code, name].filter(Boolean).join(' — ');
}
