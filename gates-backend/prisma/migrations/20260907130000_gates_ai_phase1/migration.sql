-- Gates AI Phase 1: conversation store, tool execution log, and audit trail.
-- Safe additive migration (CREATE TABLE + FKs + indexes only).

CREATE TABLE `ai_conversations` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ai_conversations_companyId_userId_idx`(`companyId`, `userId`),
    INDEX `ai_conversations_companyId_updatedAt_idx`(`companyId`, `updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

CREATE TABLE `ai_messages` (
    `id` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    `role` VARCHAR(20) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `toolCalls` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ai_messages_conversationId_createdAt_idx`(`conversationId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

CREATE TABLE `ai_tool_executions` (
    `id` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    `toolName` VARCHAR(80) NOT NULL,
    `inputArgs` JSON NOT NULL,
    `outputResult` JSON NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `executionTimeMs` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ai_tool_executions_conversationId_createdAt_idx`(`conversationId`, `createdAt`),
    INDEX `ai_tool_executions_toolName_idx`(`toolName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

CREATE TABLE `ai_audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(80) NOT NULL,
    `metadata` JSON NULL,
    `ipAddress` VARCHAR(45) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ai_audit_logs_companyId_userId_idx`(`companyId`, `userId`),
    INDEX `ai_audit_logs_companyId_createdAt_idx`(`companyId`, `createdAt`),
    INDEX `ai_audit_logs_action_idx`(`action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

ALTER TABLE `ai_conversations`
  ADD CONSTRAINT `ai_conversations_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ai_conversations`
  ADD CONSTRAINT `ai_conversations_companyId_fkey`
  FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ai_messages`
  ADD CONSTRAINT `ai_messages_conversationId_fkey`
  FOREIGN KEY (`conversationId`) REFERENCES `ai_conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ai_tool_executions`
  ADD CONSTRAINT `ai_tool_executions_conversationId_fkey`
  FOREIGN KEY (`conversationId`) REFERENCES `ai_conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ai_audit_logs`
  ADD CONSTRAINT `ai_audit_logs_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ai_audit_logs`
  ADD CONSTRAINT `ai_audit_logs_companyId_fkey`
  FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
