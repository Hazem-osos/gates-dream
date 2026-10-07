# HCM Phase 2.1 Closure Report

See agent gate output for PASS/FAIL matrix after test run.

## Delivered

- Effective-dated timeline engine (`hcm-timeline.domain.ts`, assignment/compensation timeline services)
- Employment episodes (schema migration drops one-row-per-employee unique constraint)
- Rehire creates new episode (`hcm-rehire.service.ts`)
- Contract lifecycle (`hcm-contract-lifecycle.service.ts`)
- Event conflict matrix (`hcm-event-conflict.service.ts`)
- Posted payroll `requiresPayrollAdjustment` flag
- Employee 360 multi-episode view
- Headcount by interval occupancy
- Legacy Employee org/compensation write guard expanded

## Migration

`20261005195000_hcm_phase2_1_episodes_timeline`

Existing backfilled rows remain episode 1 baseline.
