-- AlterTable
ALTER TABLE `document_layout_configs` ADD COLUMN `name` VARCHAR(120) NOT NULL DEFAULT 'تخطيط';
ALTER TABLE `document_layout_configs` ADD COLUMN `isDefault` BOOLEAN NOT NULL DEFAULT false;

-- DropIndex
DROP INDEX `document_layout_configs_companyId_branchId_documentType_key` ON `document_layout_configs`;

-- CreateIndex
CREATE INDEX `document_layout_configs_companyId_isDefault_idx` ON `document_layout_configs`(`companyId`, `isDefault`);

-- Existing single-per-type rows become the default shape.
UPDATE `document_layout_configs` SET `isDefault` = true, `name` = CASE
  WHEN `documentType` = 'TAX_INVOICE' THEN 'الفاتورة الضريبية'
  WHEN `documentType` = 'CONTRACTOR_INVOICE' THEN 'مستخلص مقاول'
  WHEN `documentType` = 'REAL_ESTATE_RECEIPT' THEN 'إيصال عقاري'
  WHEN `documentType` = 'DEBIT_NOTE' THEN 'إشعار خصم'
  WHEN `documentType` = 'PAYMENT_SCHEDULE' THEN 'جدول السداد'
  ELSE 'التخطيط العام'
END;
