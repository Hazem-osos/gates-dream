'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { useOnboardingStatus } from '@/lib/hooks/useOnboardingStatus';
import { useRouter } from 'next/navigation';
import { useInvalidateQuery } from '@/lib/hooks/useApi';
import { onboardingStatusQueryKey } from '@/lib/onboarding/onboarding-status-cache';
import { readAcademyProgress } from '@/lib/onboarding/academyProgress';
import {
  GATES_FOUNDATION_TOUR_DONE_EVENT,
  isFoundationTourFinishedSession,
  setFoundationTourFinishedSession,
} from '@/lib/onboarding/tourSession';
import { Button } from '@/app/components/ui';

export function WelcomeTourCard() {
  const { data: res, isLoading } = useOnboardingStatus(true);
  const router = useRouter();
  const invalidate = useInvalidateQuery();
  const [dismissing, setDismissing] = useState(false);
  const [localFoundationDone, setLocalFoundationDone] = useState(false);

  useEffect(() => {
    const sync = () => {
      setLocalFoundationDone(
        isFoundationTourFinishedSession() ||
          readAcademyProgress().completedPrograms.includes('foundation-8')
      );
    };
    sync();
    window.addEventListener('gates:academy-progress', sync);
    window.addEventListener(GATES_FOUNDATION_TOUR_DONE_EVENT, sync);
    return () => {
      window.removeEventListener('gates:academy-progress', sync);
      window.removeEventListener(GATES_FOUNDATION_TOUR_DONE_EVENT, sync);
    };
  }, []);

  const status = res?.data;
  const show =
    !isLoading &&
    status?.isOnboarded &&
    !status.hasCompletedTour &&
    !localFoundationDone &&
    !status.hasCreatedFirstInvoice;

  if (!show) return null;

  const skipTour = async () => {
    setDismissing(true);
    try {
      await apiClient.post('/onboarding/complete-tour');
      setFoundationTourFinishedSession();
      await invalidate(onboardingStatusQueryKey);
    } finally {
      setDismissing(false);
    }
  };

  return (
    <div
      className="mb-6 rounded-2xl border border-indigo-200/80 bg-gradient-to-l from-sky-50 via-white to-indigo-50/40 p-4 shadow-sm"
      dir="rtl"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <p className="flex-1 text-sm text-slate-800 leading-relaxed">
          🎯 <span className="font-semibold">تدريب سريع:</span> تعرف على كيفية إصدار أول فاتورة والبحث
          السريع في أقل من دقيقة.
        </p>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="primary"
            size="sm"
            data-tour="new-invoice-action"
            onClick={() => router.push('/academy')}
          >
            🚀 أكاديمية Gates الذكية
          </Button>
          <button
            type="button"
            disabled={dismissing}
            onClick={() => void skipTour()}
            className="text-xs font-medium text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100"
            aria-label="تخطي التدريب"
          >
            ✕ تخطي
          </button>
        </div>
      </div>
    </div>
  );
}
