'use client';

/**
 * Rich educational tour tooltip — styling and copy are applied via TourPopover.decorateTourPopover (driver.js).
 * This module documents the UX contract and re-exports keyboard helpers.
 */
export { decorateTourPopover, clearTourBodyClass, forceDriverDomCleanup } from '@/components/onboarding/TourPopover';
export { useTourKeyboard } from '@/components/onboarding/useInteractiveTour';

export const TOUR_TOOLTIP_COPY = {
  closeLabel: '✕ إنهاء الجولة',
  prevLabel: '➔ السابق',
  nextLabel: 'التالي ➔',
  stepBadge: (current: number, total: number) => `محطة ${current} من ${total}`,
} as const;
