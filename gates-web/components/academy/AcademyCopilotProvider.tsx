'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { fetchAcademyStatus, fetchAcademyTour, postAcademyProgress } from '@/lib/academy/api';
import { academySlugFromPath } from '@/lib/academy/module-map';
import type { AcademyTourPlan } from '@/lib/academy/types';
import { useGatesAi } from '@/lib/hooks/useGatesAi';
import { AcademySmartTrigger } from './AcademySmartTrigger';
import { AcademySpotlightOverlay } from './AcademySpotlightOverlay';

function isHiddenPath(pathname: string | null): boolean {
  if (!pathname) return true;
  return ['/login', '/register', '/forgot-password', '/logout', '/onboarding', '/academy'].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

export function AcademyCopilotRoot() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { open: chatOpen, sending, streaming } = useGatesAi();

  const [badgeVisible, setBadgeVisible] = useState(false);
  const [plan, setPlan] = useState<AcademyTourPlan | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [active, setActive] = useState(false);
  const launchingRef = useRef(false);

  const slug = searchParams.get('academyMission') || academySlugFromPath(pathname);
  const paused = active && (chatOpen || sending || streaming);

  const persist = useCallback(
    (input: { isCompleted?: boolean; lastStepIndex?: number; dismissed?: boolean }) => {
      if (!slug) return;
      void postAcademyProgress({ moduleSlug: slug, ...input });
    },
    [slug]
  );

  const stopTour = useCallback(
    (completed: boolean) => {
      setActive(false);
      setPlan(null);
      setStepIndex(0);
      setBadgeVisible(false);
      persist(completed ? { isCompleted: true, lastStepIndex: 0 } : { dismissed: true });
    },
    [persist]
  );

  const startTour = useCallback(async () => {
    if (!slug || launchingRef.current) return;
    launchingRef.current = true;
    try {
      const next = await fetchAcademyTour(slug, pathname ?? undefined);
      if (!next?.steps?.length) return;
      setPlan(next);
      setStepIndex(0);
      setActive(true);
      setBadgeVisible(false);
      persist({ lastStepIndex: 0 });
      if (searchParams.get('academyMission')) {
        router.replace(pathname || '/');
      }
    } finally {
      launchingRef.current = false;
    }
  }, [slug, pathname, persist, router, searchParams]);

  useEffect(() => {
    if (isHiddenPath(pathname) || !slug || active) {
      setBadgeVisible(false);
      return;
    }
    let cancelled = false;
    void fetchAcademyStatus(slug, pathname ?? undefined).then((status) => {
      if (cancelled || !status) return;
      setBadgeVisible(status.shouldTrigger);
    });
    return () => {
      cancelled = true;
    };
  }, [pathname, slug, active]);

  useEffect(() => {
    if (!searchParams.get('academyMission') || isHiddenPath(pathname)) return;
    void startTour();
  }, [searchParams, pathname, startTour]);

  const goTo = useCallback(
    (index: number) => {
      if (!plan) return;
      if (index >= plan.steps.length) {
        stopTour(true);
        return;
      }
      const next = Math.max(0, index);
      setStepIndex(next);
      persist({ lastStepIndex: next });
    },
    [plan, persist, stopTour]
  );

  return (
    <>
      <AcademySmartTrigger
        visible={badgeVisible && !active && !isHiddenPath(pathname)}
        estimatedSeconds={60}
        onStart={() => void startTour()}
        onDismiss={() => {
          setBadgeVisible(false);
          persist({ dismissed: true });
        }}
      />
      {active && plan ? (
        <>
          {paused ? (
            <div className="fixed bottom-6 right-6 z-[73] max-w-sm rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-900 shadow-lg">
              الجولة متوقفة مؤقتاً — أجب في Gates Intelligence ثم نكمل من نفس الخطوة.
            </div>
          ) : null}
          <AcademySpotlightOverlay
            plan={plan}
            stepIndex={stepIndex}
            paused={paused}
            onPrev={() => goTo(stepIndex - 1)}
            onNext={() => goTo(stepIndex + 1)}
            onFinish={() => stopTour(false)}
          />
        </>
      ) : null}
    </>
  );
}
