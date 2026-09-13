ALTER TABLE `customer_contract_groups`
  ADD COLUMN `categoryId` VARCHAR(191) NULL;

CREATE INDEX `customer_contract_groups_categoryId_idx` ON `customer_contract_groups`(`categoryId`);

ALTER TABLE `customer_contract_groups`
  ADD CONSTRAINT `customer_contract_groups_categoryId_fkey`
    FOREIGN KEY (`categoryId`) REFERENCES `item_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
