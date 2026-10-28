-- AlterTable
ALTER TABLE `companies` ADD COLUMN `aiEnabled` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `lastLoginAt` DATETIME(3) NULL,
    ADD COLUMN `loginCount` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `platform_admins` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `platform_admins_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `platform_audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `adminId` VARCHAR(191) NULL,
    `adminEmail` VARCHAR(191) NOT NULL,
    `action` VARCHAR(80) NOT NULL,
    `targetType` VARCHAR(40) NOT NULL,
    `targetId` VARCHAR(64) NULL,
    `targetCompanyId` VARCHAR(64) NULL,
    `details` JSON NULL,
    `ip` VARCHAR(64) NULL,
    `userAgent` VARCHAR(255) NULL,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `platform_audit_logs_at_idx`(`at`),
    INDEX `platform_audit_logs_targetCompanyId_at_idx`(`targetCompanyId`, `at`),
    INDEX `platform_audit_logs_adminId_at_idx`(`adminId`, `at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `platform_settings` (
    `key` VARCHAR(100) NOT NULL,
    `value` JSON NOT NULL,
    `updatedBy` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_activity_days` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `day` DATE NOT NULL,
    `requestCount` INTEGER NOT NULL DEFAULT 0,
    `activeMinutes` INTEGER NOT NULL DEFAULT 0,
    `firstSeenAt` DATETIME(3) NOT NULL,
    `lastSeenAt` DATETIME(3) NOT NULL,

    INDEX `user_activity_days_companyId_day_idx`(`companyId`, `day`),
    INDEX `user_activity_days_day_idx`(`day`),
    UNIQUE INDEX `user_activity_days_userId_day_key`(`userId`, `day`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_activity_days` ADD CONSTRAINT `user_activity_days_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_activity_days` ADD CONSTRAINT `user_activity_days_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

