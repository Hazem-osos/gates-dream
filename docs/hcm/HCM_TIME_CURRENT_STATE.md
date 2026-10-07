# HCM Time — Current State Audit (Phase 3)

| Asset | Classification | Notes |
|-------|----------------|-------|
| `HrAttendanceRecord` | **LEGACY / KEEP** | JSON+kinds MVP (`shift`, `holiday`, `sheet`, …). Not authoritative time results. |
| `attendance.routes.ts` | **KEEP (legacy)** | CRUD on `HrAttendanceRecord`; unchanged for regression. |
| `work-shifts/page.tsx` | **EVOLVE** | Still legacy POST; canonical shifts via `POST /api/v1/hr/time/shifts`. |
| `employee-attendance-preview`, fingerprint sheet | **DEPRECATE (UI shell)** | Replace with HCM time ops when wired. |
| `employee-working-days`, leave-day defs | **MIGRATE (future)** | Overlap with `HcmWorkSchedule` / `HcmCalendarDay`. |
| `employee-absence-overtime` | **KEEP** | Payroll-adjacent manual input; not time-engine fed. |
| Device/fingerprint backend | **REPLACE** | Phase 3: `HcmTimeDevice`, mapping, manual/API ingest. |
| `payroll-engine` OT/absence fields | **KEEP** | Documented in `HCM_TIME_PAYROLL_BOUNDARY.md`. |
| `HcmTimePunch` → `HcmAttendanceDay` | **CANONICAL** | New pipeline under `services/time/`. |

**Migration decision:** `HrAttendanceRecord` stays **LEGACY READ-ONLY**; no fabricated raw punches from legacy summaries in Phase 3.

**Phase 2.1 debt (record only):** concurrent rehire IT, position-capacity race IT, legacy contract/org direct-write audit.
