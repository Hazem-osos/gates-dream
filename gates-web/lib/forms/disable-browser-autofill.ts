/** Stops Chrome / password-managers from suggesting previously typed values. */
export function disableBrowserAutofill(target: EventTarget | null) {
  if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) {
    return;
  }
  if (target.dataset.keepAutocomplete === 'true') return;
  if (target instanceof HTMLInputElement) {
    const type = target.type;
    if (type === 'password' || type === 'hidden') return;
    const current = target.autocomplete;
    if (current === 'username' || current === 'current-password' || current === 'new-password') {
      return;
    }
  }
  target.setAttribute('autocomplete', 'off');
  target.setAttribute('data-1p-ignore', 'true');
  target.setAttribute('data-lpignore', 'true');
}

export function stampNoAutofill(root: ParentNode | null) {
  if (!root) return;
  root.querySelectorAll('input, textarea').forEach((el) => disableBrowserAutofill(el));
}
