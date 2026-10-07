# Attendance Policy

`HcmAttendancePolicy.rules` JSON:

- `lateGraceMinutes`, `lateGraceMode`: `FULL` | `EXCESS_ONLY`
- `earlyLeaveGraceMinutes`
- `rounding.*`: clock-in/out/worked/overtime
- `minimumOvertimeMinutes`

Policies are company-scoped and effective-dated. Raw punches are never rounded.
