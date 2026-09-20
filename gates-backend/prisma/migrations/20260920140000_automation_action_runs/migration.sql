-- Generic n8n action execution / idempotency ledger.
-- Unique on (companyId, eventId, ruleId, actionType) is the durable claim.

-- CreateEnum
CREATE TABLE `automation_action_runs` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(255) NOT NULL,
    `ruleId` VARCHAR(36) NOT NULL,
    `actionType` VARCHAR(255) NOT NULL,
    `correlationId` VARCHAR(255) NOT NULL,
    `status` ENUM('PENDING', 'SUCCEEDED', 'FAILED') NOT NULL,
    `resultEntityType` VARCHAR(100) NULL,
    `resultEntityId` VARCHAR(36) NULL,
    `errorMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `automation_action_runs_companyId_eventId_ruleId_actionType_key`(`companyId`, `eventId`, `ruleId`, `actionType`),
    INDEX `automation_action_runs_companyId_idx`(`companyId`),
    INDEX `automation_action_runs_companyId_correlationId_idx`(`companyId`, `correlationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `automation_action_runs` ADD CONSTRAINT `automation_action_runs_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
