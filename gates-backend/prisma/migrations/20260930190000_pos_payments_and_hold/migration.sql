-- Phase 2: parked drafts and payment lines.
-- Does not rewrite historical tender columns or close any session.

ALTER TABLE `pos_orders` ADD COLUMN `notes` TEXT NULL;
ALTER TABLE `pos_orders` ADD COLUMN `heldAt` DATETIME(3) NULL;
ALTER TABLE `pos_orders` ADD COLUMN `heldBy` VARCHAR(191) NULL;
ALTER TABLE `pos_order_lines` ADD COLUMN `notes` VARCHAR(191) NULL;

CREATE TABLE `pos_payments` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `method` VARCHAR(20) NOT NULL,
  `amount` DECIMAL(15, 2) NOT NULL,
  `tenderedAmount` DECIMAL(15, 2) NULL,
  `changeAmount` DECIMAL(15, 2) NULL,
  `safeId` VARCHAR(191) NULL,
  `bankAccountId` VARCHAR(191) NULL,
  `currencyCode` VARCHAR(191) NOT NULL DEFAULT 'EGP',
  `referenceNumber` VARCHAR(120) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `pos_payments_orderId_idx` (`orderId`),
  INDEX `pos_payments_companyId_idx` (`companyId`),
  CONSTRAINT `pos_payments_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `pos_payments_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `pos_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `pos_payments_safeId_fkey` FOREIGN KEY (`safeId`) REFERENCES `safes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `pos_payments_bankAccountId_fkey` FOREIGN KEY (`bankAccountId`) REFERENCES `bank_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `pos_orders_companyId_status_heldAt_idx` ON `pos_orders`(`companyId`, `status`, `heldAt`);
