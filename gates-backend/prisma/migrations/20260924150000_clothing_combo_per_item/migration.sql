-- Allow the same color and size on more than one item.
ALTER TABLE `clothing_combos` DROP INDEX `clothing_combos_companyId_colorId_sizeId_key`;
CREATE UNIQUE INDEX `clothing_combos_company_item_color_size_key` ON `clothing_combos`(`companyId`, `itemId`, `colorId`, `sizeId`);
