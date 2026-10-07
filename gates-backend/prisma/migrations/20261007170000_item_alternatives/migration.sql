-- CreateTable
CREATE TABLE `item_alternatives` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `alternativeItemId` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(15, 4) NOT NULL,
    `lineOrder` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `item_alternatives_companyId_itemId_idx`(`companyId`, `itemId`),
    UNIQUE INDEX `item_alternatives_companyId_itemId_alternativeItemId_key`(`companyId`, `itemId`, `alternativeItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `item_alternatives` ADD CONSTRAINT `item_alternatives_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_alternatives` ADD CONSTRAINT `item_alternatives_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_alternatives` ADD CONSTRAINT `item_alternatives_alternativeItemId_fkey` FOREIGN KEY (`alternativeItemId`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
