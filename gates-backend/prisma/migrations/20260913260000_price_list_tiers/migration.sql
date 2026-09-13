ALTER TABLE `price_lists`
  ADD COLUMN `priceMode` VARCHAR(191) NULL;

ALTER TABLE `item_prices`
  ADD COLUMN `discount` DECIMAL(8, 4) NULL,
  ADD COLUMN `wholesale` DECIMAL(18, 4) NULL,
  ADD COLUMN `semiWholesale` DECIMAL(18, 4) NULL,
  ADD COLUMN `exportPrice` DECIMAL(18, 4) NULL,
  ADD COLUMN `representativePrice` DECIMAL(18, 4) NULL,
  ADD COLUMN `retailPrice` DECIMAL(18, 4) NULL,
  ADD COLUMN `consumerPrice` DECIMAL(18, 4) NULL;
