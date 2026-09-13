'use client';

import type { PopoverDOM } from 'driver.js';
import {
  applyTourPopoverPosition,
  stepSelectorAtIndex,
  stepPopoverPlacementAtIndex,
} from '@/components/onboarding/tourPopoverPosition';

type PopoverRenderOpts = {
  config: { steps?: unknown[] };
  state: { activeIndex?: number };
  index?: number;
};

export type TourPopoverExtras = {
  stationTitle?: string;
  checkpointPrompt?: string;
  /** Canonical step in full program (multi-route tours). */
  programStepIndex?: number;
  totalProgramSteps?: number;
  /** Full program steps for selector/placement when driver uses route-scoped steps. */
  programSteps?: unknown[];
};

const SPOTLIGHT_CLASS = 'gates-tour-spotlight';

export function applyTourSpotlight(element: Element | undefined, active: boolean) {
  if (!element || !(element instanceof HTMLElement)) return;
  element.classList.toggle(SPOTLIGHT_CLASS, active);
}

export function decorateTourPopover(
  popover: PopoverDOM,
  opts: PopoverRenderOpts,
  extras: TourPopoverExtras = {}
) {
  const totalSteps = extras.totalProgramSteps ?? opts.config.steps?.length ?? 1;
  const index =
    extras.programStepIndex ?? opts.state.activeIndex ?? opts.index ?? 0;
  const currentStep = index + 1;
  const isLastStep = currentStep >= totalSteps;

  const { wrapper, title, description, footer, closeButton, previousButton, nextButton, progress } =
    popover;

  wrapper.classList.add('gates-tour-popover');
  wrapper.setAttribute('dir', 'rtl');
  document.body.classList.add('gates-tour-active');

  title.className = 'gates-tour-title break-words leading-snug';
  description.className = 'gates-tour-description break-words leading-relaxed';

  let station = wrapper.querySelector<HTMLElement>('[data-gates-tour-station]');
  if (extras.stationTitle) {
    if (!station) {
      station = document.createElement('p');
      station.setAttribute('data-gates-tour-station', '');
      wrapper.insertBefore(station, title);
    }
    station.className = 'text-[11px] font-semibold text-sky-600 mb-1';
    station.textContent = extras.stationTitle;
  } else if (station) {
    station.remove();
  }

  let checkpoint = wrapper.querySelector<HTMLElement>('[data-gates-tour-checkpoint]');
  if (extras.checkpointPrompt) {
    if (!checkpoint) {
      checkpoint = document.createElement('div');
      checkpoint.setAttribute('data-gates-tour-checkpoint', '');
      description.insertAdjacentElement('afterend', checkpoint);
    }
    checkpoint.className =
      'mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 leading-relaxed';
    checkpoint.textContent = `🎯 ${extras.checkpointPrompt}`;
  } else if (checkpoint) {
    checkpoint.remove();
  }

  if (progress) progress.style.display = 'none';

  let header = wrapper.querySelector<HTMLElement>('[data-gates-tour-header]');
  if (!header) {
    header = document.createElement('div');
    header.setAttribute('data-gates-tour-header', '');
    wrapper.insertBefore(header, title);
  }
  header.className =
    'flex items-center justify-between gap-2 mb-3 pb-0 border-0 text-right dir-rtl';

  closeButton.className = 'driver-popover-close-btn gates-tour-skip shrink-0';
  closeButton.textContent = '✕ إنهاء الجولة';
  closeButton.setAttribute('type', 'button');
  closeButton.setAttribute('aria-label', 'تخطي الجولة');

  let pill = header.querySelector<HTMLElement>('[data-gates-tour-step-pill]');
  if (!pill) {
    pill = document.createElement('span');
    pill.setAttribute('data-gates-tour-step-pill', '');
    header.appendChild(pill);
  }
  pill.className =
    'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200 shrink-0';
  pill.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-sky-600" aria-hidden="true"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/></svg><span>محطة ${currentStep} من ${totalSteps}</span>`;

  if (closeButton.parentElement !== header) {
    header.appendChild(closeButton);
  }

  footer.className = 'gates-tour-footer text-right dir-rtl';

  let dots = footer.querySelector<HTMLElement>('[data-gates-tour-dots]');
  if (!dots) {
    dots = document.createElement('div');
    dots.setAttribute('data-gates-tour-dots', '');
    footer.insertBefore(dots, footer.firstChild);
  }
  dots.className = 'flex items-center gap-1.5 flex-1 justify-start';
  dots.replaceChildren();
  for (let i = 0; i < totalSteps; i += 1) {
    const dot = document.createElement('span');
    dot.className =
      i === index
        ? 'h-1.5 w-5 bg-sky-600 rounded-full transition-all duration-300'
        : 'h-1.5 w-1.5 bg-slate-200 rounded-full transition-all duration-300';
    dot.setAttribute('aria-hidden', 'true');
    dots.appendChild(dot);
  }

  const nav = popover.footerButtons;
  nav.setAttribute('data-gates-tour-nav', '');
  nav.className = 'gates-tour-nav driver-popover-navigation-btns shrink-0';

  previousButton.className = [
    'driver-popover-prev-btn',
    'driver-popover-footer-btn',
    'gates-tour-btn-prev',
    currentStep <= 1 ? 'driver-popover-btn-disabled' : '',
  ]
    .filter(Boolean)
    .join(' ');
  previousButton.textContent = '➔ السابق';
  previousButton.type = 'button';
  previousButton.disabled = currentStep <= 1;

  nextButton.className = [
    'driver-popover-next-btn',
    'driver-popover-footer-btn',
    'gates-tour-btn-next',
    isLastStep ? 'driver-popover-done-btn' : '',
  ]
    .filter(Boolean)
    .join(' ');
  nextButton.type = 'button';
  nextButton.disabled = false;
  nextButton.textContent = isLastStep ? 'انطلاق 🚀' : 'التالي ➔';

  if (previousButton.parentElement !== nav) nav.appendChild(previousButton);
  if (nextButton.parentElement !== nav) nav.appendChild(nextButton);

  const arrow = wrapper.querySelector('.driver-popover-arrow');
  if (arrow instanceof HTMLElement) {
    arrow.style.display = 'none';
  }

  const selector =
    extras.programStepIndex != null && extras.programSteps
      ? stepSelectorAtIndex(extras.programSteps, extras.programStepIndex)
      : stepSelectorAtIndex(opts.config.steps ?? [], index);
  if (selector) {
    const stepsForPlacement = extras.programSteps ?? opts.config.steps ?? [];
    const placement = stepPopoverPlacementAtIndex(
      stepsForPlacement,
      extras.programStepIndex ?? index
    );
    requestAnimationFrame(() => {
      applyTourPopoverPosition(wrapper, selector, placement);
    });
  }
}

export function clearTourBodyClass() {
  document.body.classList.remove('gates-tour-active');
}

/** Remove driver.js overlay/popover if destroy did not fully tear down UI. */
export function forceDriverDomCleanup() {
  if (typeof document === 'undefined') return;
  document.body.classList.remove('driver-active', 'gates-tour-active');
  document.querySelectorAll('.driver-popover').forEach((el) => el.remove());
  document.getElementById('driver-page-overlay')?.remove();
  document.querySelectorAll('.driver-overlay').forEach((el) => el.remove());
  document.querySelectorAll('.gates-tour-spotlight').forEach((el) => {
    el.classList.remove('gates-tour-spotlight');
  });
}
