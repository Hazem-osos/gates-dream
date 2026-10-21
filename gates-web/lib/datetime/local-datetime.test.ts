import { datetimeLocalToIso, toDatetimeLocalValue } from './local-datetime';

describe('local datetime for document date inputs', () => {
  it('round-trips seconds so a save without editing the date keeps the same instant', () => {
    const iso = '2026-10-19T12:04:07.000Z';
    const local = toDatetimeLocalValue(iso);
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    expect(datetimeLocalToIso(local)).toBe(iso);
  });

  it('keeps typed seconds on the page input', () => {
    const iso = datetimeLocalToIso('2026-06-10T08:15:33');
    expect(toDatetimeLocalValue(iso)).toBe('2026-06-10T08:15:33');
  });
});
