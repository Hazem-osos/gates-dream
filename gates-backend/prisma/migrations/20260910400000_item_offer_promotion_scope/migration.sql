-- Item promotions: named offers, optional source item, and scope filters.

ALTER TABLE `item_offers` DROP FOREIGN KEY `item_offers_fromItemId_fkey`;

ALTER TABLE `item_offers` MODIFY `fromItemId` VARCHAR(191) NULL;

ALTER TABLE `item_offers`
  ADD COLUMN `nameAr` VARCHAR(191) NULL,
  ADD COLUMN `applyToAllParties` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `applyToAllPatterns` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `targetPartyIds` JSON NULL,
  ADD COLUMN `targetPatternIds` JSON NULL;

ALTER TABLE `item_offers` ADD CONSTRAINT `item_offers_fromItemId_fkey` FOREIGN KEY (`fromItemId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
