-- Partial document conversion ledger. Existing invoiceId / convertedInvoiceId stay.
CREATE TABLE `invoice_line_sources` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `invoiceLineId` VARCHAR(191) NOT NULL,
  `sourceKind` VARCHAR(191) NOT NULL,
  `sourceLineId` VARCHAR(191) NOT NULL,
  `baseQuantity` DECIMAL(18, 4) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `invoice_line_sources_companyId_sourceKind_sourceLineId_idx` (`companyId`, `sourceKind`, `sourceLineId`),
  INDEX `invoice_line_sources_invoiceLineId_idx` (`invoiceLineId`),
  CONSTRAINT `invoice_line_sources_invoiceLineId_fkey`
    FOREIGN KEY (`invoiceLineId`) REFERENCES `invoice_lines`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Color/size combos can belong to one item. Existing company-wide rows stay valid.
ALTER TABLE `clothing_combos`
  ADD COLUMN `itemId` VARCHAR(191) NULL,
  ADD INDEX `clothing_combos_itemId_idx` (`itemId`),
  ADD CONSTRAINT `clothing_combos_itemId_fkey`
    FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
