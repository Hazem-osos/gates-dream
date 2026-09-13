CREATE TABLE `representative_commission_policies` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NULL,
  `arabicName` VARCHAR(191) NOT NULL,
  `englishName` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `representative_commission_policies_companyId_idx`
  ON `representative_commission_policies`(`companyId`);
CREATE INDEX `representative_commission_policies_code_idx`
  ON `representative_commission_policies`(`code`);

ALTER TABLE `representative_commission_policies`
  ADD CONSTRAINT `representative_commission_policies_companyId_fkey`
    FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `representative_commission_policy_tiers` (
  `id` VARCHAR(191) NOT NULL,
  `policyId` VARCHAR(191) NOT NULL,
  `targetSlice` VARCHAR(191) NULL,
  `targetPct` DECIMAL(8, 4) NULL,
  `commissionPct` DECIMAL(8, 4) NULL,
  `bonusPct` DECIMAL(8, 4) NULL,
  `increasePct` DECIMAL(8, 4) NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `representative_commission_policy_tiers_policyId_idx`
  ON `representative_commission_policy_tiers`(`policyId`);

ALTER TABLE `representative_commission_policy_tiers`
  ADD CONSTRAINT `representative_commission_policy_tiers_policyId_fkey`
    FOREIGN KEY (`policyId`) REFERENCES `representative_commission_policies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
