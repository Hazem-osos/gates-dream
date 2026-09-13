-- Evolve immutable AI chat audit (keeps existing action/metadata rows).

ALTER TABLE `ai_audit_logs`
  ADD COLUMN `userRole` VARCHAR(80) NULL,
  ADD COLUMN `currentScreen` VARCHAR(500) NULL,
  ADD COLUMN `userPrompt` TEXT NULL,
  ADD COLUMN `toolCalls` JSON NULL,
  ADD COLUMN `toolResults` JSON NULL,
  ADD COLUMN `aiResponse` LONGTEXT NULL,
  ADD COLUMN `status` ENUM('SUCCESS', 'FAILED', 'OUT_OF_SCOPE', 'BLOCKED_BY_RBAC') NOT NULL DEFAULT 'SUCCESS',
  ADD COLUMN `latencyMs` INTEGER NULL,
  ADD COLUMN `tokensUsed` INTEGER NULL;

CREATE INDEX `ai_audit_logs_userId_createdAt_idx` ON `ai_audit_logs`(`userId`, `createdAt`);
