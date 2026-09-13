CREATE TABLE `representative_commission_quantities` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NULL,
  `itemName` VARCHAR(191) NULL,
  `policyName` VARCHAR(191) NULL,
  `days` INTEGER NULL,
  `commissionBefore` DECIMAL(18, 4) NULL,
  `commissionAfter` DECIMAL(18, 4) NULL,
  `cashRate` DECIMAL(18, 4) NULL,
  `creditRate` DECIMAL(18, 4) NULL,
  `percent` DECIMAL(8, 4) NULL,
  `target` DECIMAL(18, 4) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `representative_commission_quantities_companyId_idx`
  ON `representative_commission_quantities`(`companyId`);
CREATE INDEX `representative_commission_quantities_itemId_idx`
  ON `representative_commission_quantities`(`itemId`);

ALTER TABLE `representative_commission_quantities`
  ADD CONSTRAINT `representative_commission_quantities_companyId_fkey`
    FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `representative_commission_quantities_itemId_fkey`
    FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
