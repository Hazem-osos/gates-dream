-- Replace static/video Gates Academy progress with per-user interactive tour tracking.

CREATE TABLE `user_tour_progress` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `moduleSlug` VARCHAR(80) NOT NULL,
    `isCompleted` BOOLEAN NOT NULL DEFAULT false,
    `lastStepIndex` INTEGER NOT NULL DEFAULT 0,
    `dismissedCount` INTEGER NOT NULL DEFAULT 0,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `user_tour_progress_userId_moduleSlug_key`(`userId`, `moduleSlug`),
    INDEX `user_tour_progress_companyId_userId_idx`(`companyId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `user_tour_progress`
  ADD CONSTRAINT `user_tour_progress_companyId_fkey`
  FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `user_tour_progress`
  ADD CONSTRAINT `user_tour_progress_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
