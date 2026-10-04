-- إذن الإضافة يحمل المورد، وإذن الصرف يحمل العميل.
ALTER TABLE `receipts` ADD COLUMN `supplierId` VARCHAR(191) NULL;
ALTER TABLE `issues` ADD COLUMN `customerId` VARCHAR(191) NULL;

CREATE INDEX `receipts_supplierId_idx` ON `receipts`(`supplierId`);
CREATE INDEX `issues_customerId_idx` ON `issues`(`customerId`);

ALTER TABLE `receipts` ADD CONSTRAINT `receipts_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `issues` ADD CONSTRAINT `issues_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
