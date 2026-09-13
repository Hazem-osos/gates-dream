'use client';

import { useEffect } from 'react';
import {
  GATES_ACADEMY_PREPARE_STEP_EVENT,
  type AcademyPrepareStepDetail,
} from '@/lib/onboarding/tourCheckpoints';
import { scrollTourTargetIntoViewCenter } from '@/lib/onboarding/tourEngine';

/** Scroll issue-page tour targets into view when the academy step activates. */
export function useIssueTourPrepare() {
  useEffect(() => {
    const onPrepare = (ev: Event) => {
      const stepId = (ev as CustomEvent<AcademyPrepareStepDetail>).detail?.stepId;
      if (stepId !== 'inv-movements') return;
      window.setTimeout(() => {
        const el = document.querySelector('[data-tour="stock-movement-types"]');
        if (el) scrollTourTargetIntoViewCenter(el);
      }, 120);
    };
    window.addEventListener(GATES_ACADEMY_PREPARE_STEP_EVENT, onPrepare);
    return () => window.removeEventListener(GATES_ACADEMY_PREPARE_STEP_EVENT, onPrepare);
  }, []);
}
