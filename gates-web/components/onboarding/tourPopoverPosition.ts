/** Popover width must match CSS (380px). */
export const TOUR_POPOVER_WIDTH = 380;
const VIEWPORT_MARGIN = 16;
const GAP = 20;
const ESTIMATED_POPOVER_HEIGHT = 280;

export type TourPopoverSide = 'top' | 'bottom' | 'left' | 'right';
export type TourPopoverAlign = 'start' | 'center' | 'end';

export type TourPopoverPlacement = {
  side?: TourPopoverSide;
  align?: TourPopoverAlign;
};

export type TourPopoverCoords = {
  top: string;
  left: string;
  placement: TourPopoverSide;
};

function measurePopoverHeight(fallback: number): number {
  if (typeof document === 'undefined') return fallback;
  const pop = document.querySelector<HTMLElement>('.gates-tour-popover.driver-popover');
  const h = pop?.getBoundingClientRect().height;
  return h && h > 40 ? h : fallback;
}

/** Prefer visible target when selectors match multiple nodes (e.g. coa-tree). */
export function resolveTourTarget(selector: string): Element | null {
  if (typeof document === 'undefined') return null;
  const nodes = document.querySelectorAll(selector);
  if (nodes.length === 0) return null;
  if (nodes.length === 1) return nodes[0]!;

  let best: Element | null = null;
  let bestArea = nodes.length > 1 ? Infinity : 0;
  const pickLargest = nodes.length === 1;
  for (const node of nodes) {
    const r = node.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (r.bottom < 0 || r.top > window.innerHeight) continue;
    const area = r.width * r.height;
    if (pickLargest) {
      if (area > bestArea) {
        bestArea = area;
        best = node;
      }
    } else if (area >= 32 * 32 && area < bestArea) {
      bestArea = area;
      best = node;
    }
  }
  if (!best && !pickLargest) {
    for (const node of nodes) {
      const r = node.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const area = r.width * r.height;
      if (area < bestArea) {
        bestArea = area;
        best = node;
      }
    }
  }
  return best ?? nodes[0]!;
}

function alignHorizontal(
  rect: DOMRect,
  popoverWidth: number,
  align: TourPopoverAlign
): number {
  if (align === 'start') {
    return rect.right - popoverWidth;
  }
  if (align === 'end') {
    return rect.left;
  }
  return rect.left + rect.width / 2 - popoverWidth / 2;
}

function alignVertical(rect: DOMRect, popoverHeight: number, align: TourPopoverAlign): number {
  if (align === 'start') {
    return rect.top;
  }
  if (align === 'end') {
    return rect.bottom - popoverHeight;
  }
  return rect.top + rect.height / 2 - popoverHeight / 2;
}

function clampHorizontal(left: number, popoverWidth: number): number {
  const maxLeft = window.innerWidth - VIEWPORT_MARGIN - popoverWidth;
  return Math.max(VIEWPORT_MARGIN, Math.min(left, maxLeft));
}

function clampVertical(top: number, popoverHeight: number): number {
  const maxTop = window.innerHeight - VIEWPORT_MARGIN - popoverHeight;
  return Math.max(VIEWPORT_MARGIN, Math.min(top, maxTop));
}

function overlapArea(
  a: { top: number; left: number; width: number; height: number },
  b: DOMRect
): number {
  const xOverlap = Math.max(0, Math.min(a.left + a.width, b.right) - Math.max(a.left, b.left));
  const yOverlap = Math.max(0, Math.min(a.top + a.height, b.bottom) - Math.max(a.top, b.top));
  return xOverlap * yOverlap;
}

function layoutForSide(
  side: TourPopoverSide,
  rect: DOMRect,
  popoverWidth: number,
  popoverHeight: number,
  align: TourPopoverAlign
): { top: number; left: number; side: TourPopoverSide } {
  if (side === 'bottom') {
    return {
      side,
      top: rect.bottom + GAP,
      left: alignHorizontal(rect, popoverWidth, align),
    };
  }
  if (side === 'top') {
    return {
      side,
      top: rect.top - popoverHeight - GAP,
      left: alignHorizontal(rect, popoverWidth, align),
    };
  }
  if (side === 'left') {
    return {
      side,
      left: rect.left - popoverWidth - GAP,
      top: alignVertical(rect, popoverHeight, align),
    };
  }
  return {
    side: 'right',
    left: rect.right + GAP,
    top: alignVertical(rect, popoverHeight, align),
  };
}

export function computeTourPopoverStyle(
  targetSelector: string,
  popoverHeight = ESTIMATED_POPOVER_HEIGHT,
  placement: TourPopoverPlacement = {}
): TourPopoverCoords {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { top: '50%', left: '50%', placement: 'bottom' };
  }

  const el = resolveTourTarget(targetSelector);
  if (!el) {
    return { top: '50%', left: '50%', placement: 'bottom' };
  }

  const rect = el.getBoundingClientRect();
  const popoverWidth = Math.min(TOUR_POPOVER_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
  const preferred = placement.side ?? 'bottom';
  const align = placement.align ?? 'center';

  const sideOrder: TourPopoverSide[] = [
    preferred,
    preferred === 'bottom' ? 'top' : preferred === 'top' ? 'bottom' : preferred === 'left' ? 'right' : 'left',
    'left',
    'right',
    'top',
    'bottom',
  ];
  const uniqueSides = [...new Set(sideOrder)];

  let best: { top: number; left: number; side: TourPopoverSide; score: number } | null = null;

  for (const side of uniqueSides) {
    const raw = layoutForSide(side, rect, popoverWidth, popoverHeight, align);
    const left = clampHorizontal(raw.left, popoverWidth);
    const top = clampVertical(raw.top, popoverHeight);
    const box = { top, left, width: popoverWidth, height: popoverHeight };
    const overlap = overlapArea(box, rect);
    const score = overlap + (side === preferred ? 0 : 1_000);
    if (!best || score < best.score) {
      best = { top, left, side: raw.side, score };
    }
  }

  const picked = best ?? layoutForSide('top', rect, popoverWidth, popoverHeight, align);

  return {
    top: `${Math.round(picked.top)}px`,
    left: `${Math.round(picked.left)}px`,
    placement: picked.side,
  };
}

export function applyTourPopoverPosition(
  wrapper: HTMLElement,
  targetSelector: string,
  placement: TourPopoverPlacement = {}
): TourPopoverCoords {
  const popoverHeight = measurePopoverHeight(ESTIMATED_POPOVER_HEIGHT);
  const coords = computeTourPopoverStyle(targetSelector, popoverHeight, placement);
  const popoverWidth = Math.min(
    TOUR_POPOVER_WIDTH,
    typeof window !== 'undefined' ? window.innerWidth - VIEWPORT_MARGIN * 2 : TOUR_POPOVER_WIDTH
  );

  wrapper.style.setProperty('position', 'fixed', 'important');
  wrapper.style.setProperty('top', coords.top, 'important');
  wrapper.style.setProperty('left', coords.left, 'important');
  wrapper.style.setProperty('right', 'auto', 'important');
  wrapper.style.setProperty('bottom', 'auto', 'important');
  wrapper.style.setProperty('transform', 'none', 'important');
  wrapper.style.setProperty('margin', '0', 'important');
  wrapper.style.setProperty('z-index', '9999', 'important');
  wrapper.style.setProperty('width', `${popoverWidth}px`, 'important');
  wrapper.style.setProperty('max-width', '90vw', 'important');
  wrapper.dataset.gatesTourPlacement = coords.placement;

  const refine = () => {
    const refined = computeTourPopoverStyle(
      targetSelector,
      measurePopoverHeight(ESTIMATED_POPOVER_HEIGHT),
      placement
    );
    wrapper.style.setProperty('top', refined.top, 'important');
    wrapper.style.setProperty('left', refined.left, 'important');
    wrapper.dataset.gatesTourPlacement = refined.placement;
  };

  requestAnimationFrame(refine);
  window.setTimeout(refine, 180);

  return coords;
}

export function stepSelectorAtIndex(steps: unknown[], index: number): string | null {
  const step = steps[index] as { element?: string | Element | (() => Element) } | undefined;
  if (!step?.element || typeof step.element !== 'string') return null;
  return step.element;
}

export function stepPopoverPlacementAtIndex(steps: unknown[], index: number): TourPopoverPlacement {
  const step = steps[index] as {
    popover?: { side?: string; align?: string };
  };
  const side = step?.popover?.side;
  const align = step?.popover?.align;
  return {
    side:
      side === 'top' || side === 'bottom' || side === 'left' || side === 'right' ? side : undefined,
    align: align === 'start' || align === 'center' || align === 'end' ? align : undefined,
  };
}
