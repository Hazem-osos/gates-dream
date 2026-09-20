-- AlterTable
ALTER TABLE `invoices` ADD COLUMN `driverId` VARCHAR(191) NULL,
    ADD COLUMN `distributorId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `invoices_driverId_idx` ON `invoices`(`driverId`);
CREATE INDEX `invoices_distributorId_idx` ON `invoices`(`distributorId`);

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_driverId_fkey` FOREIGN KEY (`driverId`) REFERENCES `delegates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_distributorId_fkey` FOREIGN KEY (`distributorId`) REFERENCES `delegates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
