-- Additive observability / retry columns on the generic action-run ledger.
-- Unique claim key is unchanged: (companyId, eventId, ruleId, actionType).

ALTER TABLE `automation_action_runs`
    ADD COLUMN `eventType` VARCHAR(255) NULL,
    ADD COLUMN `attemptCount` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `completedAt` DATETIME(3) NULL,
    ADD COLUMN `resultMetadata` JSON NULL,
    ADD COLUMN `lastErrorCode` VARCHAR(100) NULL;

CREATE INDEX `automation_action_runs_companyId_eventId_idx`
    ON `automation_action_runs`(`companyId`, `eventId`);

CREATE INDEX `automation_action_runs_companyId_status_updatedAt_idx`
    ON `automation_action_runs`(`companyId`, `status`, `updatedAt`);
