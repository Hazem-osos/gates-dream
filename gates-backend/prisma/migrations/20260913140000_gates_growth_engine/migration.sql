-- Gates Growth Engine (MySQL)
-- CreateTable
CREATE TABLE `growth_opportunities` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `fingerprint` VARCHAR(191) NOT NULL,
    `type` VARCHAR(60) NOT NULL,
    `category` ENUM('REVENUE', 'CASH_RECOVERY', 'INVENTORY', 'SAVINGS', 'PRICING', 'CUSTOMERS', 'COSTS') NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NOT NULL,
    `whyDetected` TEXT NOT NULL,
    `status` ENUM('NEW', 'REVIEWED', 'ACTION_TAKEN', 'WON', 'LOST', 'DISMISSED', 'EXPIRED') NOT NULL DEFAULT 'NEW',
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    `estimatedValue` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `actionedValue` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `realizedValue` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `currencyCode` VARCHAR(10) NOT NULL DEFAULT 'EGP',
    `module` VARCHAR(40) NULL,
    `entityType` VARCHAR(40) NULL,
    `entityId` VARCHAR(191) NULL,
    `confidence` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `evidence` JSON NULL,
    `recommendedActions` JSON NULL,
    `metadata` JSON NULL,
    `generatedBy` VARCHAR(40) NOT NULL DEFAULT 'growth-engine',
    `aiExplanation` TEXT NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewedBy` VARCHAR(191) NULL,
    `actionedAt` DATETIME(3) NULL,
    `actionedBy` VARCHAR(191) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `dismissedAt` DATETIME(3) NULL,
    `dismissedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `growth_opportunities_companyId_fingerprint_key`(`companyId`, `fingerprint`),
    INDEX `growth_opportunities_companyId_status_idx`(`companyId`, `status`),
    INDEX `growth_opportunities_companyId_category_idx`(`companyId`, `category`),
    INDEX `growth_opportunities_companyId_priority_idx`(`companyId`, `priority`),
    INDEX `growth_opportunities_companyId_type_idx`(`companyId`, `type`),
    INDEX `growth_opportunities_companyId_createdAt_idx`(`companyId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `growth_opportunity_actions` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `opportunityId` VARCHAR(191) NOT NULL,
    `actionKey` VARCHAR(60) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `growth_opportunity_actions_companyId_opportunityId_idx`(`companyId`, `opportunityId`),
    INDEX `growth_opportunity_actions_opportunityId_createdAt_idx`(`opportunityId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `growth_attributions` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `opportunityId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(40) NOT NULL,
    `entityType` VARCHAR(40) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `isRealized` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `growth_attr_uniq`(`companyId`, `opportunityId`, `entityType`, `entityId`),
    INDEX `growth_attributions_companyId_opportunityId_idx`(`companyId`, `opportunityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `growth_opportunities` ADD CONSTRAINT `growth_opportunities_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `growth_opportunity_actions` ADD CONSTRAINT `growth_opportunity_actions_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `growth_opportunity_actions` ADD CONSTRAINT `growth_opportunity_actions_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `growth_opportunities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `growth_attributions` ADD CONSTRAINT `growth_attributions_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `growth_attributions` ADD CONSTRAINT `growth_attributions_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `growth_opportunities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
