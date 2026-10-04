-- AlterTable
ALTER TABLE `suppliers` ADD COLUMN `priceListId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `suppliers_priceListId_idx` ON `suppliers`(`priceListId`);

-- AddForeignKey
ALTER TABLE `suppliers` ADD CONSTRAINT `suppliers_priceListId_fkey` FOREIGN KEY (`priceListId`) REFERENCES `price_lists`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
