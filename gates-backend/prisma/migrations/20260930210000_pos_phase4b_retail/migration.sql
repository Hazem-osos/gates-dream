-- Phase 4B: line list price, order discount percent, configurable payment methods.
-- Historical PosPayment rows stay readable. New columns are nullable.

ALTER TABLE `pos_orders` ADD COLUMN `headerDiscountPercent` DECIMAL(5, 2) NULL;
ALTER TABLE `pos_order_lines` ADD COLUMN `listPrice` DECIMAL(15, 4) NULL;

ALTER TABLE `pos_payments` ADD COLUMN `settlementType` VARCHAR(20) NULL;
ALTER TABLE `pos_payments` ADD COLUMN `methodLabel` VARCHAR(80) NULL;
ALTER TABLE `pos_payments` ADD COLUMN `paymentMethodId` VARCHAR(191) NULL;

CREATE TABLE `pos_payment_methods` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `code` VARCHAR(20) NOT NULL,
  `displayName` VARCHAR(80) NOT NULL,
  `settlementType` VARCHAR(20) NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `safeId` VARCHAR(191) NULL,
  `bankAccountId` VARCHAR(191) NULL,
  `branchId` VARCHAR(191) NULL,
  `terminalId` VARCHAR(191) NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `pos_payment_methods_companyId_code_key` (`companyId`, `code`),
  INDEX `pos_payment_methods_companyId_isActive_idx` (`companyId`, `isActive`),
  CONSTRAINT `pos_payment_methods_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `pos_payment_methods_safeId_fkey` FOREIGN KEY (`safeId`) REFERENCES `safes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `pos_payment_methods_bankAccountId_fkey` FOREIGN KEY (`bankAccountId`) REFERENCES `bank_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `pos_payment_methods_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `pos_payment_methods_terminalId_fkey` FOREIGN KEY (`terminalId`) REFERENCES `pos_terminals`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `pos_payments`
  ADD CONSTRAINT `pos_payments_paymentMethodId_fkey`
  FOREIGN KEY (`paymentMethodId`) REFERENCES `pos_payment_methods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
