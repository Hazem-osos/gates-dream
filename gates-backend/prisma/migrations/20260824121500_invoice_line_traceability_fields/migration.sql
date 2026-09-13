-- Sales Invoice Enterprise Redesign: lot/traceability + line-note fields the
-- frontend line grid already collected (salesInvoiceLineSchema) but which
-- had no matching column here, so they were silently dropped before
-- reaching the API. Purely descriptive — do not feed GL posting or costing.

-- AlterTable
ALTER TABLE `invoice_lines`
    ADD COLUMN `batchNumber` VARCHAR(191) NULL,
    ADD COLUMN `expiryDate` DATETIME(3) NULL,
    ADD COLUMN `productionDate` DATETIME(3) NULL,
    ADD COLUMN `serialNumbers` TEXT NULL,
    ADD COLUMN `lineNotes` TEXT NULL,
    ADD COLUMN `taxExemptionReason` VARCHAR(191) NULL;
