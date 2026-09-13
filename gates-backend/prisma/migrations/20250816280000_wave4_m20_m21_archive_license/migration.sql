-- M20 Document attachments + M21 tenant subscriptions

CREATE TABLE `document_attachments` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `branchId` VARCHAR(191) NULL,
  `entityType` VARCHAR(40) NOT NULL,
  `entityId` VARCHAR(191) NOT NULL,
  `fileName` VARCHAR(255) NOT NULL,
  `storagePath` VARCHAR(512) NOT NULL,
  `fileUrl` VARCHAR(512) NULL,
  `fileSize` INTEGER NOT NULL,
  `mimeType` VARCHAR(120) NOT NULL,
  `description` TEXT NULL,
  `tags` JSON NULL,
  `uploadedById` VARCHAR(191) NULL,
  `deletedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `document_attachments_companyId_entityType_entityId_idx`(`companyId`, `entityType`, `entityId`),
  INDEX `document_attachments_companyId_deletedAt_idx`(`companyId`, `deletedAt`),
  CONSTRAINT `document_attachments_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `document_attachments_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tenant_subscriptions` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `planType` VARCHAR(20) NOT NULL,
  `status` VARCHAR(20) NOT NULL,
  `startDate` DATETIME(3) NOT NULL,
  `expiryDate` DATETIME(3) NULL,
  `maxBranches` INTEGER NOT NULL DEFAULT 1,
  `maxUsers` INTEGER NOT NULL DEFAULT 5,
  `maxStorageMb` INTEGER NOT NULL DEFAULT 512,
  `allowedModules` JSON NOT NULL,
  `licenseKeyHash` VARCHAR(128) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `tenant_subscriptions_companyId_key`(`companyId`),
  INDEX `tenant_subscriptions_status_idx`(`status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `tenant_subscriptions_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
