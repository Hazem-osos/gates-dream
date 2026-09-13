'use client';

import type { Driver } from 'driver.js';
import { useEffect } from 'react';

export {
  waitForElement,
  resolveTourStepIndex,
  scrollTourTargetIntoViewCenter,
  isElementVisible,
  type ResolveTourStepResult,
  type TourProgramLike,
} from '@/lib/onboarding/tourEngine';

export {
  ACADEMY_MODULE_CARDS,
  RICH_TOUR_STEPS_BY_PROGRAM,
  toursData,
} from '@/lib/onboarding/toursData';

export type { AcademyModuleCardData, RichTourStep, TourModuleSlug } from '@/lib/onboarding/toursData';

/** @deprecated alias */
export { toursData as tourConfig } from '@/lib/onboarding/toursData';

export function useTourKeyboard(driver: Driver | null, active: boolean) {
  useEffect(() => {
    if (!active || !driver?.isActive()) return;

    const onKey = (e: KeyboardEvent) => {
      if (!driver.isActive()) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        driver.destroy();
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (driver.isLastStep()) {
          driver.destroy();
        } else {
          driver.moveNext();
        }
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (!driver.isFirstStep()) driver.movePrevious();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [driver, active]);
}
