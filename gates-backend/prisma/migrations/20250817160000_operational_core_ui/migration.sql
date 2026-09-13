-- Operational core UI: company profile fields, user prefs, branch defaults, notifications

ALTER TABLE `companies` ADD COLUMN `contactEmail` VARCHAR(191) NULL;

ALTER TABLE `company_settings` ADD COLUMN `logoUrl` VARCHAR(191) NULL;

ALTER TABLE `users` ADD COLUMN `phone` VARCHAR(191) NULL,
    ADD COLUMN `preferredLanguage` VARCHAR(10) NULL DEFAULT 'ar';

ALTER TABLE `branches`
    ADD COLUMN `defaultWarehouseId` VARCHAR(191) NULL,
    ADD COLUMN `defaultSafeId` VARCHAR(191) NULL;

CREATE TABLE `system_notifications` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `type` VARCHAR(20) NOT NULL DEFAULT 'INFO',
    `category` VARCHAR(40) NULL,
    `linkUrl` VARCHAR(191) NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `system_notifications_companyId_userId_isRead_createdAt_idx` ON `system_notifications`(`companyId`, `userId`, `isRead`, `createdAt`);
CREATE INDEX `system_notifications_companyId_createdAt_idx` ON `system_notifications`(`companyId`, `createdAt`);

ALTER TABLE `system_notifications` ADD CONSTRAINT `system_notifications_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `system_notifications` ADD CONSTRAINT `system_notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `branches` ADD CONSTRAINT `branches_defaultWarehouseId_fkey` FOREIGN KEY (`defaultWarehouseId`) REFERENCES `warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `branches` ADD CONSTRAINT `branches_defaultSafeId_fkey` FOREIGN KEY (`defaultSafeId`) REFERENCES `safes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
