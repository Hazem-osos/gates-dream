/** Card-form tokens aligned with semantic GATES surfaces. */

export const compactLabelClass =
  'mb-1 flex items-center gap-1 text-xs font-semibold text-foreground-muted';

export const compactControlClass =
  'h-8 w-full min-w-0 max-w-[var(--erp-field-max,32rem)] rounded-lg border border-border bg-surface-2 px-2 text-sm font-medium text-foreground placeholder:text-foreground-muted/70 transition-colors focus:border-primary focus:bg-surface-1 focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50';

/** Serials, quantities, amounts — wider, easier to read in operations forms. */
export const compactNumericControlClass =
  'h-9 w-full min-w-0 max-w-[var(--erp-field-max,32rem)] rounded-lg border border-border bg-surface-2 px-3 text-base font-semibold tabular-nums text-end text-foreground placeholder:text-foreground-muted/70 transition-colors focus:border-primary focus:bg-surface-1 focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50';

/** Document serial / order number (left-aligned labels, monospace-friendly). */
export const compactSerialControlClass =
  'h-9 w-full min-w-[8.5rem] max-w-[var(--erp-field-max,32rem)] rounded-lg border border-border bg-surface-2 px-3 text-sm font-semibold tabular-nums tracking-wide text-foreground placeholder:text-foreground-muted/70 transition-colors focus:border-primary focus:bg-surface-1 focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50';

/** Native date inputs stay LTR so the calendar icon sits on the inline-end. */
export const dateControlClass =
  '[direction:ltr] text-end [color-scheme:inherit] [field-sizing:fixed] [&::-webkit-date-and-time-value]:text-end [&::-webkit-calendar-picker-indicator]:ms-1.5 [&::-webkit-calendar-picker-indicator]:me-0 [&::-webkit-calendar-picker-indicator]:h-4 [&::-webkit-calendar-picker-indicator]:w-4 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70 hover:[&::-webkit-calendar-picker-indicator]:opacity-100';

export const compactControlShellClass =
  'flex h-8 w-full max-w-[var(--erp-field-max,32rem)] items-center overflow-hidden rounded-lg border border-border bg-surface-2 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15';

export const compactFieldErrorClass = 'mt-1 block text-start text-xs text-danger';

/** Unified save / cancel pair — clustered toward the inline-end. */
export const formActionButtonClass =
  'h-8 min-h-8 w-auto min-w-[5.25rem] shrink-0 px-2.5 text-xs font-semibold';

export const formActionPairClass =
  'flex max-w-full min-w-0 flex-wrap items-center justify-end gap-1.5';

export const denseTableWrapClass =
  'erp-scroll-x min-w-0 w-full max-w-full overflow-x-scroll rounded-lg border border-border bg-surface-1';

export const denseTableClass = 'w-max min-w-full border-collapse text-sm';

export const denseTheadClass =
  'h-10 bg-primary text-primary-foreground text-xs font-semibold tracking-wider sticky top-0 z-10';

export const denseThClass = 'px-3 text-start whitespace-nowrap border-e border-white/20 last:border-e-0';

export const denseTdClass = 'px-3 text-start text-foreground border-e border-border last:border-e-0';

export const denseTrClass =
  'h-10 hover:bg-surface-hover transition-colors border-b border-border';
