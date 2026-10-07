-- Manufacturing form (FrmManufDesc) parity: header extras + line columns + metadata JSON

ALTER TABLE `bill_of_materials`
  ADD COLUMN `formMetadata` JSON NULL;

ALTER TABLE `bom_lines`
  ADD COLUMN `lineDescription` VARCHAR(500) NULL,
  ADD COLUMN `warehouseId` VARCHAR(191) NULL,
  ADD COLUMN `manufacturedItemId` VARCHAR(191) NULL;
