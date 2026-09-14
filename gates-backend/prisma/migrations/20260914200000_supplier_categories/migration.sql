CREATE TABLE `supplier_categories` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `legacyCode` VARCHAR(30) NOT NULL,
  `arabicName` VARCHAR(191) NOT NULL,
  `englishName` VARCHAR(191) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `supplier_categories_companyId_legacyCode_key` (`companyId`, `legacyCode`),
  INDEX `supplier_categories_companyId_idx` (`companyId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `suppliers` ADD COLUMN `supplierCategoryId` VARCHAR(191) NULL;
CREATE INDEX `suppliers_supplierCategoryId_idx` ON `suppliers`(`supplierCategoryId`);
ALTER TABLE `suppliers` ADD CONSTRAINT `suppliers_supplierCategoryId_fkey` FOREIGN KEY (`supplierCategoryId`) REFERENCES `supplier_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `supplier_categories` ADD CONSTRAINT `supplier_categories_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
