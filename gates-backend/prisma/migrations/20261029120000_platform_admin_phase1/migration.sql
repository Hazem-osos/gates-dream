-- AlterTable
ALTER TABLE `platform_admins` ADD COLUMN `role` VARCHAR(20) NOT NULL DEFAULT 'OWNER',
    ADD COLUMN `totpSecretEnc` VARCHAR(255) NULL,
    ADD COLUMN `totpEnabledAt` DATETIME(3) NULL,
    ADD COLUMN `totpLastStep` INTEGER NULL,
    ADD COLUMN `sessionVersion` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `user_login_events` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NULL,
    `identifier` VARCHAR(191) NOT NULL,
    `success` BOOLEAN NOT NULL,
    `reason` VARCHAR(40) NULL,
    `ip` VARCHAR(64) NULL,
    `userAgent` VARCHAR(255) NULL,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_login_events_userId_at_idx`(`userId`, `at`),
    INDEX `user_login_events_companyId_at_idx`(`companyId`, `at`),
    INDEX `user_login_events_success_at_idx`(`success`, `at`),
    INDEX `user_login_events_at_idx`(`at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `platform_announcements` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `body` TEXT NOT NULL,
    `level` VARCHAR(16) NOT NULL DEFAULT 'info',
    `audience` VARCHAR(16) NOT NULL DEFAULT 'ALL',
    `companyIds` JSON NULL,
    `startsAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endsAt` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `platform_announcements_isActive_startsAt_idx`(`isActive`, `startsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
