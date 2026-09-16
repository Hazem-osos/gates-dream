'use client';

import { useEffect, useRef } from 'react';
import { useApiQuery } from '@/lib/hooks/useApi';
import { useFirstCompany } from '@/lib/hooks/useFirstCompany';
import { apiClient } from '@/lib/api/client';
import {
  GATES_ACADEMY_PROGRESS_EVENT,
  hydrateAcademyProgressFromServer,
  readAcademyProgress,
  type AcademyProgressState,
} from '@/lib/onboarding/academyProgress';

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/**
 * Backend progress sync (plan item 6) — mirrors `useTaxesUiSlice`'s
 * `advancedSettings.<key>` pattern with no new Prisma model. `localStorage`
 * (via `academyProgress.ts`) stays the instant/offline read path; this hook
 * only pushes a debounced `PUT /companies/:id/settings` on change and pulls
 * once on load to merge in progress made on another device.
 *
 * Mount once near the app root (inside `ProductTourProvider`) — safe to call
 * multiple times since it no-ops without a resolved `companyId`.
 */
export function useAcademyProgressSync() {
  const { companyId } = useFirstCompany();
  const settingsRowRef = useRef<Record<string, unknown> | undefined>(undefined);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedRef = useRef(false);

  const { data: settingsRes } = useApiQuery<Record<string, unknown>>(
    ['company-settings', companyId ?? 'none', 'academy-progress'],
    `/companies/${companyId}/settings`,
    undefined,
    { enabled: Boolean(companyId) }
  );

  useEffect(() => {
    settingsRowRef.current = settingsRes?.data as Record<string, unknown> | undefined;
    if (!settingsRes?.data || hydratedRef.current) return;
    hydratedRef.current = true;
    const adv = asRecord(settingsRes.data);
    const remote = adv.academyProgress as AcademyProgressState | undefined;
    hydrateAcademyProgressFromServer(remote ?? null);
  }, [settingsRes?.data]);

  useEffect(() => {
    if (!companyId) return;

    const pushProgress = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const existingAdv = asRecord(settingsRowRef.current);
        const body = {
          advancedSettings: {
            ...existingAdv,
            academyProgress: readAcademyProgress(),
          },
        };
        apiClient.put(`/companies/${companyId}/settings`, body, { skipSuccessNotify: true }).catch(() => {
          /* best-effort — localStorage cache stays authoritative offline */
        });
      }, 1500);
    };

    window.addEventListener(GATES_ACADEMY_PROGRESS_EVENT, pushProgress);
    return () => {
      window.removeEventListener(GATES_ACADEMY_PROGRESS_EVENT, pushProgress);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [companyId]);
}
