# Shift & Scheduling

- `HcmWorkShift`: start/end minutes, cross-midnight, punch windows, expected minutes, unpaid break.
- `HcmWorkSchedule`: `FIXED_WEEKLY` or rotation via JSON `pattern.weekly`.
- `HcmEmployeeScheduleAssignment`: effective-dated per employment episode.

Resolution precedence: employee assignment → schedule code `DEFAULT` → `NO_SCHEDULE` exception.

Logical work date: overnight shifts anchor to shift start calendar date (see `scheduleResolutionService.shiftBounds`).
