# HCM Time Architecture

Pipeline: **Device/Manual/Import → Raw Punch → Normalization/Match → Schedule → Attendance Day → Exceptions/Corrections → Lock → Payroll read model.**

Services live under `gates-backend/src/modules/hr/services/time/`.

API: `/api/v1/hr/time/*`

Pre-production hardening (Phase 2.1 debt): concurrent rehire test, position-capacity race test, legacy contract/org write audit — recorded, not Phase 3 scope.
