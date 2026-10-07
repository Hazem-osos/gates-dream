# Leave × Time Integration

Approved leave is read from `HcmLeaveRequestDay` (status APPROVED). Attendance recalculation applies `leaveTimeOverlayService` — no punch mutation.

Effects on `HcmAttendanceDay`: `paidLeaveMinutes`, `unpaidLeaveMinutes`, `sickLeaveMinutes`, `otherApprovedLeaveMinutes`, adjusted `absenceMinutes` / `dayClassification`.

Locked days: cancel/change returns 423; no silent mutation.
