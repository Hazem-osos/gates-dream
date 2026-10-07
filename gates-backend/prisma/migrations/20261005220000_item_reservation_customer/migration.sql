ALTER TABLE `item_reservations`
  ADD COLUMN `customerId` VARCHAR(191) NULL AFTER `itemId`;

CREATE INDEX `item_reservations_companyId_customerId_idx`
  ON `item_reservations`(`companyId`, `customerId`);

ALTER TABLE `item_reservations`
  ADD CONSTRAINT `item_reservations_customerId_fkey`
    FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
