CREATE TABLE `representative_commission_values` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `serial` VARCHAR(191) NULL,
  `name` VARCHAR(191) NOT NULL,
  `target` DECIMAL(18, 4) NULL,
  `targetPercentage` DECIMAL(8, 4) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `representative_commission_values_companyId_idx`
  ON `representative_commission_values`(`companyId`);
CREATE INDEX `representative_commission_values_serial_idx`
  ON `representative_commission_values`(`serial`);

ALTER TABLE `representative_commission_values`
  ADD CONSTRAINT `representative_commission_values_companyId_fkey`
    FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `representative_commission_value_tiers` (
  `id` VARCHAR(191) NOT NULL,
  `policyId` VARCHAR(191) NOT NULL,
  `days` INTEGER NULL,
  `commissionPct` DECIMAL(8, 4) NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `representative_commission_value_tiers_policyId_idx`
  ON `representative_commission_value_tiers`(`policyId`);

ALTER TABLE `representative_commission_value_tiers`
  ADD CONSTRAINT `representative_commission_value_tiers_policyId_fkey`
    FOREIGN KEY (`policyId`) REFERENCES `representative_commission_values`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
