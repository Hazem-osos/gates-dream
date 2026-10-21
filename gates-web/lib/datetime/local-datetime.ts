const DATETIME_LOCAL = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?/;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Value for `<input type="datetime-local" step="1">` — local date + time with seconds. */
export function toDatetimeLocalValue(value?: string | Date | null): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** Persist the on-screen datetime (including seconds) as ISO. Date-only stays date-only midnight local. */
export function datetimeLocalToIso(value: string): string {
  const raw = value.trim();
  if (!raw) return new Date().toISOString();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T00:00:00`).toISOString();
  }
  const match = DATETIME_LOCAL.exec(raw);
  if (match) {
    const seconds = match[3] ?? '00';
    return new Date(`${match[1]}T${match[2]}:${seconds}`).toISOString();
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}
