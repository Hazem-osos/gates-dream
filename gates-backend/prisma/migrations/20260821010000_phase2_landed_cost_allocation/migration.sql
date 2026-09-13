-- Phase 2 (H9): landed-cost capitalization.
--
-- Freight/customs/insurance/handling incurred to bring a PURCHASE invoice's
-- goods into the warehouse are initially recorded against an expense
-- account (e.g. paid to a customs broker). This document reallocates that
-- already-recorded cost into the received items' inventory value —
-- proportional to each line's merchandise value — via a reclass journal
-- entry and a moving-average cost top-up.
CREATE TABLE `landed_cost_allocations` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `serial` VARCHAR(191) NULL,
    `date` DATETIME(3) NOT NULL,
    `hijriDate` VARCHAR(191) NULL,
    `totalAmount` DECIMAL(18, 4) NOT NULL,
    `expenseAccountId` VARCHAR(191) NOT NULL,
    `record` VARCHAR(191) NULL,
    `isPosted` BOOLEAN NOT NULL DEFAULT false,
    `postedAt` DATETIME(3) NULL,
    `isCancelled` BOOLEAN NOT NULL DEFAULT false,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `landed_cost_allocations_companyId_idx`(`companyId`),
    INDEX `landed_cost_allocations_invoiceId_idx`(`invoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `landed_cost_allocation_lines` (
    `id` VARCHAR(191) NOT NULL,
    `allocationId` VARCHAR(191) NOT NULL,
    `invoiceLineId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `merchandiseValue` DECIMAL(18, 4) NOT NULL,
    `allocatedAmount` DECIMAL(18, 4) NOT NULL,
    `quantity` DECIMAL(18, 4) NOT NULL,
    `unitCostAdded` DECIMAL(18, 4) NOT NULL,

    INDEX `landed_cost_allocation_lines_allocationId_idx`(`allocationId`),
    INDEX `landed_cost_allocation_lines_invoiceLineId_idx`(`invoiceLineId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `landed_cost_allocations` ADD CONSTRAINT `landed_cost_allocations_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `landed_cost_allocations` ADD CONSTRAINT `landed_cost_allocations_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `landed_cost_allocations` ADD CONSTRAINT `landed_cost_allocations_expenseAccountId_fkey` FOREIGN KEY (`expenseAccountId`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `landed_cost_allocation_lines` ADD CONSTRAINT `landed_cost_allocation_lines_allocationId_fkey` FOREIGN KEY (`allocationId`) REFERENCES `landed_cost_allocations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `landed_cost_allocation_lines` ADD CONSTRAINT `landed_cost_allocation_lines_invoiceLineId_fkey` FOREIGN KEY (`invoiceLineId`) REFERENCES `invoice_lines`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `landed_cost_allocation_lines` ADD CONSTRAINT `landed_cost_allocation_lines_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
