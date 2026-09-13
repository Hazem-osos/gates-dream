-- Offset account + display name for scoped rates on إضافات وخصومات أخرى.

ALTER TABLE `other_addition_discount_types`
  ADD COLUMN `offsetAccountId` CHAR(36) NULL;

ALTER TABLE `other_addition_discount_percentages`
  ADD COLUMN `sourceName` VARCHAR(191) NULL;
