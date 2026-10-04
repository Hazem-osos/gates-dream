import { isZeroNumberDisplay } from '@/lib/grid/evaluateMathExpression';

type TrackedInput = HTMLInputElement & {
  _valueTracker?: { setValue: (value: string) => void };
};

function isNumericEntry(el: HTMLInputElement): boolean {
  if (el.readOnly || el.disabled) return false;
  if (el.dataset.mathNumber != null) return false;
  if (el.type === 'number') return true;
  return el.inputMode === 'decimal' || el.inputMode === 'numeric';
}

function setNativeValue(el: TrackedInput, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(el, value);
  el._valueTracker?.setValue(value);
}

/**
 * A focused numeric field that is only 0 is cleared so the next key replaces it.
 * Untouched blur puts the 0 back. Typing keeps whatever the user entered.
 */
export function installClearZeroOnFocus(): () => void {
  let watched: TrackedInput | null = null;
  let original = '';
  let typed = false;
  let raf = 0;

  const stop = (restore: boolean) => {
    cancelAnimationFrame(raf);
    const el = watched;
    watched = null;
    if (restore && el && !typed && document.activeElement !== el) {
      setNativeValue(el, original);
    }
    typed = false;
  };

  const tick = () => {
    const el = watched;
    if (!el || typed || document.activeElement !== el) {
      stop(false);
      return;
    }
    if (isZeroNumberDisplay(el.value)) setNativeValue(el, '');
    raf = requestAnimationFrame(tick);
  };

  const arm = (el: TrackedInput) => {
    stop(false);
    original = el.value;
    typed = false;
    watched = el;
    setNativeValue(el, '');
    raf = requestAnimationFrame(tick);
  };

  const onFocusIn = (event: FocusEvent) => {
    const el = event.target;
    if (!(el instanceof HTMLInputElement) || !isNumericEntry(el)) return;
    window.setTimeout(() => {
      if (document.activeElement !== el) return;
      if (!isZeroNumberDisplay(el.value)) return;
      arm(el);
    }, 0);
  };

  const onInput = (event: Event) => {
    if (event.target === watched) typed = true;
  };

  const onFocusOut = (event: FocusEvent) => {
    if (event.target === watched) stop(true);
  };

  document.addEventListener('focusin', onFocusIn);
  document.addEventListener('input', onInput, true);
  document.addEventListener('focusout', onFocusOut);
  return () => {
    stop(false);
    document.removeEventListener('focusin', onFocusIn);
    document.removeEventListener('input', onInput, true);
    document.removeEventListener('focusout', onFocusOut);
  };
}
