-- Phase 3: return line links, drawer movements, immutable close snapshot.
-- Does not rewrite posted sales or historical tender columns.

ALTER TABLE `pos_order_lines` ADD COLUMN `originalLineId` VARCHAR(191) NULL;
CREATE INDEX `pos_order_lines_originalLineId_idx` ON `pos_order_lines`(`originalLineId`);
ALTER TABLE `pos_order_lines` ADD CONSTRAINT `pos_order_lines_originalLineId_fkey` FOREIGN KEY (`originalLineId`) REFERENCES `pos_order_lines`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE `pos_cash_movements` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `shiftId` VARCHAR(191) NOT NULL,
  `terminalId` VARCHAR(191) NOT NULL,
  `type` VARCHAR(20) NOT NULL,
  `amount` DECIMAL(15, 2) NOT NULL,
  `reason` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `contraAccountId` VARCHAR(191) NOT NULL,
  `safeId` VARCHAR(191) NOT NULL,
  `journalEntryId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `pos_cash_movements_companyId_shiftId_idx` (`companyId`, `shiftId`),
  CONSTRAINT `pos_cash_movements_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `pos_cash_movements_shiftId_fkey` FOREIGN KEY (`shiftId`) REFERENCES `pos_shifts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `pos_cash_movements_terminalId_fkey` FOREIGN KEY (`terminalId`) REFERENCES `pos_terminals`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `pos_cash_movements_safeId_fkey` FOREIGN KEY (`safeId`) REFERENCES `safes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pos_shift_closes` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `shiftId` VARCHAR(191) NOT NULL,
  `terminalId` VARCHAR(191) NOT NULL,
  `terminalName` VARCHAR(191) NOT NULL,
  `cashierId` VARCHAR(191) NULL,
  `openedAt` DATETIME(3) NOT NULL,
  `closedAt` DATETIME(3) NOT NULL,
  `openingCash` DECIMAL(15, 2) NOT NULL,
  `grossSales` DECIMAL(15, 2) NOT NULL,
  `netSales` DECIMAL(15, 2) NOT NULL,
  `returnsNet` DECIMAL(15, 2) NOT NULL,
  `cashSales` DECIMAL(15, 2) NOT NULL,
  `cashRefunds` DECIMAL(15, 2) NOT NULL,
  `cashIn` DECIMAL(15, 2) NOT NULL,
  `cashOut` DECIMAL(15, 2) NOT NULL,
  `expectedCash` DECIMAL(15, 2) NOT NULL,
  `countedCash` DECIMAL(15, 2) NOT NULL,
  `variance` DECIMAL(15, 2) NOT NULL,
  `orderCount` INTEGER NOT NULL,
  `returnCount` INTEGER NOT NULL,
  `paymentBreakdown` JSON NOT NULL,
  `journalEntryId` VARCHAR(191) NULL,
  `reopenedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `pos_shift_closes_companyId_shiftId_idx` (`companyId`, `shiftId`),
  CONSTRAINT `pos_shift_closes_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `pos_shift_closes_shiftId_fkey` FOREIGN KEY (`shiftId`) REFERENCES `pos_shifts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
