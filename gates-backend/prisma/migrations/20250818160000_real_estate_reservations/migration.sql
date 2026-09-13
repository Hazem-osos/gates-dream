-- Real estate unit reservations (حجز وحدات)
CREATE TABLE `real_estate_reservations` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `unitId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `reservationDate` DATETIME(3) NOT NULL,
    `reservationAmount` DECIMAL(15, 2) NULL,
    `notes` TEXT NULL,
    `expiryDate` DATETIME(3) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `confirmedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancellationReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `real_estate_reservations_companyId_status_idx`(`companyId`, `status`),
    INDEX `real_estate_reservations_unitId_idx`(`unitId`),
    INDEX `real_estate_reservations_customerId_idx`(`customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `real_estate_reservations` ADD CONSTRAINT `real_estate_reservations_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `real_estate_reservations` ADD CONSTRAINT `real_estate_reservations_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `real_estate_units`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `real_estate_reservations` ADD CONSTRAINT `real_estate_reservations_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
