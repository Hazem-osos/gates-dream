-- Gates AI Phase 2: human-in-the-loop write queue.
-- Safe additive migration (enum + table + FK + indexes only).

CREATE TABLE `ai_pending_actions` (
    `id` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `actionType` VARCHAR(191) NOT NULL,
    `requiredPermission` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `summaryDisplay` JSON NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'REJECTED', 'EXECUTED', 'FAILED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `executionError` TEXT NULL,
    `resultingEntityId` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ai_pending_actions_companyId_userId_status_idx`(`companyId`, `userId`, `status`),
    INDEX `ai_pending_actions_conversationId_idx`(`conversationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

ALTER TABLE `ai_pending_actions`
  ADD CONSTRAINT `ai_pending_actions_conversationId_fkey`
  FOREIGN KEY (`conversationId`) REFERENCES `ai_conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
