# Attendance & Time — Deep Audit

## Data model

**Single table:** `HrAttendanceRecord`

- `companyId`, `employeeId`, `date`, `kind`, `payload` (JSON), `notes`, `createdBy`.
- Kinds (route validation): `shift`, `holiday`, `working_day`, `absence`, `delay`, `sheet` (and similar in Zod).

**Status:** **SCHEMA + BACKEND CRUD** — not a full time-and-attendance engine.

## Backend

- `gates-backend/src/modules/hr/routes/attendance.routes.ts`
  - List with filters (`employeeId`, `kind`, date range), `take: 200` default cap.
  - Create/update/delete — direct Prisma, no processing pipeline.
- **No** services for: punches, devices, shift matching, grace, overnight, recalculation, lock after payroll.

## Frontend

- Many routes under `gates-web/app/hr/attendance/` and `hr/operations/` (fingerprint, shifts, schedules, overtime, …).
- **Classification:** **FRONTEND_ONLY / PARTIAL** — chrome and forms; not all call attendance API.
- Grep shows limited `useApiQuery` to `/hr/attendance` — most pages are UX placeholders or local state.

## Trace: employee day (as implemented)

```
[Not implemented] Raw clock event
       ↓
Manual/API: HrAttendanceRecord row (kind + payload JSON)
       ↓
[Not implemented] Calculated work hours / late / OT rules
       ↓
payroll-engine.service.ts — does NOT import attendance records
       ↓
No automatic payroll consequence from attendance
```

**Payroll link:** **NONE** verified in `payroll-engine.service.ts`.

## Calculations

| Topic | Finding |
|-------|---------|
| Formulas | **None** in attendance module |
| Duplication | UI may show labels; no shared calc library |
| Timezone | Date fields `DateTime` — boundary risk not addressed |
| Overnight shifts | **NOT SUPPORTED** |
| Raw punch immutability | Records are **editable/deletable** via API |
| Lock after payroll | **NOT SUPPORTED** |
| Biometric integration | **UI only** |

## Maturity score drivers

- **Strength:** Tenant-scoped storage hook exists; extensible JSON payload.
- **Gaps:** No shift master tied to attendance, no roster, no exception workflow, no payroll bridge.

**Attendance maturity:** **2/10** (storage MVP + UI ambition).
