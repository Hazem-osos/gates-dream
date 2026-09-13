-- Item group card fields from legacy بطاقة مجموعة أصناف.

ALTER TABLE `item_categories`
  ADD COLUMN `groupType` VARCHAR(20) NULL,
  ADD COLUMN `parentCategoryId` VARCHAR(191) NULL,
  ADD COLUMN `isFeatured` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `isTaxExempt` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `taxRate` DECIMAL(5, 2) NULL;

CREATE INDEX `item_categories_parentCategoryId_idx` ON `item_categories`(`parentCategoryId`);

ALTER TABLE `item_categories`
  ADD CONSTRAINT `item_categories_parentCategoryId_fkey`
    FOREIGN KEY (`parentCategoryId`) REFERENCES `item_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
