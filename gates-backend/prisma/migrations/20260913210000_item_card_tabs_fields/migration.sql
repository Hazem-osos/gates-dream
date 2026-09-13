-- Extra item-card fields: price mode, assembly recipe, reorder suppliers, image.

ALTER TABLE `items`
  ADD COLUMN `priceMode` VARCHAR(191) NULL,
  ADD COLUMN `priceCurrency` VARCHAR(191) NULL,
  ADD COLUMN `extraAssemblyCost` DECIMAL(18, 4) NULL,
  ADD COLUMN `extraAssemblyCostPct` DECIMAL(18, 4) NULL,
  ADD COLUMN `purchaseCount` INTEGER NULL,
  ADD COLUMN `minPurchaseQty` DECIMAL(18, 4) NULL,
  ADD COLUMN `assemblyComponents` JSON NULL,
  ADD COLUMN `preferredSuppliers` JSON NULL,
  ADD COLUMN `imageUrl` TEXT NULL;
