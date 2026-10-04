-- Idempotent: a previous attempt added columns, then the config foreign key
-- failed because company_whatsapp_configs.id and the new table use different collations.
-- Foreign keys are omitted; the app enforces the relationship.

ALTER TABLE `company_whatsapp_configs`
  MODIFY `phoneNumberId` VARCHAR(191) NULL,
  MODIFY `webhookVerifyToken` VARCHAR(191) NOT NULL DEFAULT 'managed-by-platform',
  MODIFY `isActive` BOOLEAN NOT NULL DEFAULT false;

SET @add_access = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `company_whatsapp_configs` ADD COLUMN `accessTokenEncrypted` TEXT NULL',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_whatsapp_configs' AND COLUMN_NAME = 'accessTokenEncrypted'
);
PREPARE stmt FROM @add_access; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add_display = (
  SELECT IF(COUNT(*) = 0, 'ALTER TABLE `company_whatsapp_configs` ADD COLUMN `displayPhoneNumber` VARCHAR(32) NULL', 'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_whatsapp_configs' AND COLUMN_NAME = 'displayPhoneNumber'
);
PREPARE stmt FROM @add_display; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add_status = (
  SELECT IF(COUNT(*) = 0, 'ALTER TABLE `company_whatsapp_configs` ADD COLUMN `connectionStatus` VARCHAR(32) NOT NULL DEFAULT ''disconnected''', 'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_whatsapp_configs' AND COLUMN_NAME = 'connectionStatus'
);
PREPARE stmt FROM @add_status; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add_connected = (
  SELECT IF(COUNT(*) = 0, 'ALTER TABLE `company_whatsapp_configs` ADD COLUMN `connectedAt` DATETIME(3) NULL', 'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_whatsapp_configs' AND COLUMN_NAME = 'connectedAt'
);
PREPARE stmt FROM @add_connected; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add_disconnected = (
  SELECT IF(COUNT(*) = 0, 'ALTER TABLE `company_whatsapp_configs` ADD COLUMN `disconnectedAt` DATETIME(3) NULL', 'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_whatsapp_configs' AND COLUMN_NAME = 'disconnectedAt'
);
PREPARE stmt FROM @add_disconnected; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add_waba_idx = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `company_whatsapp_configs` ADD INDEX `company_whatsapp_configs_wabaId_idx`(`wabaId`)',
    'SELECT 1'
  )
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_whatsapp_configs' AND INDEX_NAME = 'company_whatsapp_configs_wabaId_idx'
);
PREPARE stmt FROM @add_waba_idx; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `whatsapp_outbound_messages` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `configId` VARCHAR(191) NULL,
  `metaMessageId` VARCHAR(191) NULL,
  `recipientMasked` VARCHAR(32) NOT NULL,
  `templateName` VARCHAR(191) NOT NULL,
  `templateLanguage` VARCHAR(16) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'ACCEPTED',
  `acceptedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `deliveredAt` DATETIME(3) NULL,
  `readAt` DATETIME(3) NULL,
  `failedAt` DATETIME(3) NULL,
  `errorCode` VARCHAR(64) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `whatsapp_outbound_messages_companyId_metaMessageId_key`(`companyId`, `metaMessageId`),
  INDEX `whatsapp_outbound_messages_companyId_createdAt_idx`(`companyId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
