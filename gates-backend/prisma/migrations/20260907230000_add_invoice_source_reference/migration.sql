-- Invoice source document lineage (القسم والرقم)

ALTER TABLE `invoices`
  ADD COLUMN `sourceType` ENUM('QUOTATION', 'SALES_ORDER', 'PURCHASE_ORDER', 'PURCHASE_INVOICE', 'DELIVERY_NOTE', 'NONE') NOT NULL DEFAULT 'NONE',
  ADD COLUMN `sourceId` VARCHAR(191) NULL,
  ADD COLUMN `sourceNumber` VARCHAR(80) NULL;

CREATE INDEX `invoices_companyId_sourceType_sourceId_idx` ON `invoices`(`companyId`, `sourceType`, `sourceId`);
