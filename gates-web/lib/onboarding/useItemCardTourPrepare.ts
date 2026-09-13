'use client';

import { useEffect } from 'react';
import { GATES_ACADEMY_PREPARE_STEP_EVENT, type AcademyPrepareStepDetail } from '@/lib/onboarding/tourCheckpoints';

/** Switches item-card tabs when an academy tour step targets hidden panels. */
export function useItemCardTourPrepare(setActiveTab: (tab: string) => void) {
  useEffect(() => {
    const onPrepare = (ev: Event) => {
      const stepId = (ev as CustomEvent<AcademyPrepareStepDetail>).detail?.stepId;
      if (stepId === 'inv-matrix') setActiveTab('quantities');
      if (stepId === 'inv-reorder') setActiveTab('order-plan');
    };
    window.addEventListener(GATES_ACADEMY_PREPARE_STEP_EVENT, onPrepare);
    return () => window.removeEventListener(GATES_ACADEMY_PREPARE_STEP_EVENT, onPrepare);
  }, [setActiveTab]);
}
