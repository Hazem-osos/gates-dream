'use client';

/**
 * Hijri captions used to be injected next to every `<input type="date">`.
 * That mutates React-owned DOM and crashes the app on the first change
 * (`removeChild` / NotFoundError) — seen on أوراق القبض والدفع due date.
 * DatePickerWithHijri and CompactFormField already render the caption.
 */
export function AutoHijriDateCaption() {
  return null;
}
