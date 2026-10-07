-- AlterTable
ALTER TABLE `manufacturing_work_orders` ADD COLUMN `salesOrderInvoiceId` VARCHAR(191) NULL;
ALTER TABLE `manufacturing_work_orders` MODIFY `bomId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `manufacturing_work_order_lines` ADD COLUMN `lineDescription` TEXT NULL;
ALTER TABLE `manufacturing_work_order_lines` ADD COLUMN `imageUrl` LONGTEXT NULL;

-- CreateIndex
CREATE INDEX `manufacturing_work_orders_companyId_salesOrderInvoiceId_idx` ON `manufacturing_work_orders`(`companyId`, `salesOrderInvoiceId`);

-- AddForeignKey
ALTER TABLE `manufacturing_work_orders` ADD CONSTRAINT `manufacturing_work_orders_salesOrderInvoiceId_fkey` FOREIGN KEY (`salesOrderInvoiceId`) REFERENCES `invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
