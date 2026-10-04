-- AlterTable
ALTER TABLE `customers` ADD COLUMN `etaProfile` JSON NULL;

-- AlterTable
ALTER TABLE `items` ADD COLUMN `etaProfile` JSON NULL;

-- AlterTable
ALTER TABLE `e_invoice_settings` ADD COLUMN `issuerAddress` JSON NULL;
