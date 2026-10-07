# Leave Policy

`HcmLeavePolicy` is effective-dated (`effectiveFrom` / `effectiveTo`). Rules live in JSON (`leave-policy.domain.ts`).

Per-type overrides: `HcmLeavePolicyRule`. Enrollment: `HcmLeaveEnrollment` on employment episode.

Statutory localization belongs in policy configuration, not hardcoded enums.
