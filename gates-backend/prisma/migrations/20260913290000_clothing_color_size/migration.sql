CREATE TABLE `clothing_colors` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `serial` VARCHAR(191) NULL,
  `arabicName` VARCHAR(191) NOT NULL,
  `englishName` VARCHAR(191) NULL,
  `hex` VARCHAR(9) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `clothing_colors_companyId_idx` (`companyId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `clothing_sizes` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `serial` VARCHAR(191) NULL,
  `arabicName` VARCHAR(191) NOT NULL,
  `englishName` VARCHAR(191) NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `clothing_sizes_companyId_idx` (`companyId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `clothing_combos` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `colorId` VARCHAR(191) NOT NULL,
  `sizeId` VARCHAR(191) NOT NULL,
  `barcode` VARCHAR(191) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `clothing_combos_companyId_colorId_sizeId_key` (`companyId`, `colorId`, `sizeId`),
  INDEX `clothing_combos_companyId_idx` (`companyId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `clothing_colors`
  ADD CONSTRAINT `clothing_colors_companyId_fkey`
    FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `clothing_sizes`
  ADD CONSTRAINT `clothing_sizes_companyId_fkey`
    FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `clothing_combos`
  ADD CONSTRAINT `clothing_combos_companyId_fkey`
    FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `clothing_combos_colorId_fkey`
    FOREIGN KEY (`colorId`) REFERENCES `clothing_colors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `clothing_combos_sizeId_fkey`
    FOREIGN KEY (`sizeId`) REFERENCES `clothing_sizes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
