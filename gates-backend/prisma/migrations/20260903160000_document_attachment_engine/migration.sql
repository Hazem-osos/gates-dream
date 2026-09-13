-- AlterTable: evolve M20 document_attachments into the enterprise attachment engine
ALTER TABLE `document_attachments`
    ADD COLUMN `originalFileName` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `storedFileName` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `storageProvider` VARCHAR(191) NOT NULL DEFAULT 'LOCAL',
    ADD COLUMN `storagePathKey` VARCHAR(512) NOT NULL DEFAULT '',
    ADD COLUMN `fileCategory` ENUM('GENERAL', 'CAD_DRAWING', 'CONSULTANT_REPORT', 'SITE_PHOTO_DEFECT', 'BANK_LG_STAMPED_LETTER', 'SIGNED_INVOICE_COPY', 'PAYMENT_RECEIPT', 'CONTRACT_LEGAL_DOC', 'BOQ_SPECIFICATION') NOT NULL DEFAULT 'GENERAL',
    ADD COLUMN `subcontractId` VARCHAR(191) NULL,
    ADD COLUMN `subcontractInvoiceId` VARCHAR(191) NULL,
    ADD COLUMN `sitePenaltyId` VARCHAR(191) NULL,
    ADD COLUMN `materialReconciliationId` VARCHAR(191) NULL,
    ADD COLUMN `executiveMeasurementSheetId` VARCHAR(191) NULL,
    ADD COLUMN `clientContractId` VARCHAR(191) NULL,
    ADD COLUMN `clientInvoiceId` VARCHAR(191) NULL,
    ADD COLUMN `letterOfGuaranteeId` VARCHAR(191) NULL,
    ADD COLUMN `propertyUnitId` VARCHAR(191) NULL,
    ADD COLUMN `unitContractId` VARCHAR(191) NULL,
    ADD COLUMN `uploadedByUserId` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `isArchived` BOOLEAN NOT NULL DEFAULT false;

UPDATE `document_attachments`
SET
    `originalFileName` = COALESCE(NULLIF(`originalFileName`, ''), `fileName`),
    `storedFileName` = COALESCE(NULLIF(`storedFileName`, ''), `fileName`),
    `storagePathKey` = COALESCE(NULLIF(`storagePathKey`, ''), `storagePath`),
    `uploadedByUserId` = COALESCE(NULLIF(`uploadedByUserId`, ''), IFNULL(`uploadedById`, '')),
    `isArchived` = IF(`deletedAt` IS NULL, `isArchived`, true);

CREATE INDEX `document_attachments_companyId_idx` ON `document_attachments`(`companyId`);
CREATE INDEX `document_attachments_subcontractInvoiceId_idx` ON `document_attachments`(`subcontractInvoiceId`);
CREATE INDEX `document_attachments_letterOfGuaranteeId_idx` ON `document_attachments`(`letterOfGuaranteeId`);
CREATE INDEX `document_attachments_executiveMeasurementSheetId_idx` ON `document_attachments`(`executiveMeasurementSheetId`);
CREATE INDEX `document_attachments_clientInvoiceId_idx` ON `document_attachments`(`clientInvoiceId`);
CREATE INDEX `document_attachments_subcontractId_idx` ON `document_attachments`(`subcontractId`);
CREATE INDEX `document_attachments_clientContractId_idx` ON `document_attachments`(`clientContractId`);
CREATE INDEX `document_attachments_isArchived_idx` ON `document_attachments`(`isArchived`);

ALTER TABLE `document_attachments`
    ADD CONSTRAINT `document_attachments_subcontractId_fkey` FOREIGN KEY (`subcontractId`) REFERENCES `subcontracts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `document_attachments_subcontractInvoiceId_fkey` FOREIGN KEY (`subcontractInvoiceId`) REFERENCES `subcontract_invoices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `document_attachments_sitePenaltyId_fkey` FOREIGN KEY (`sitePenaltyId`) REFERENCES `site_penalties_and_snags`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `document_attachments_materialReconciliationId_fkey` FOREIGN KEY (`materialReconciliationId`) REFERENCES `material_reconciliation_logs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `document_attachments_executiveMeasurementSheetId_fkey` FOREIGN KEY (`executiveMeasurementSheetId`) REFERENCES `executive_measurement_sheets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `document_attachments_clientContractId_fkey` FOREIGN KEY (`clientContractId`) REFERENCES `client_contracts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `document_attachments_clientInvoiceId_fkey` FOREIGN KEY (`clientInvoiceId`) REFERENCES `client_invoices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `document_attachments_letterOfGuaranteeId_fkey` FOREIGN KEY (`letterOfGuaranteeId`) REFERENCES `project_letters_of_guarantee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `document_attachments_propertyUnitId_fkey` FOREIGN KEY (`propertyUnitId`) REFERENCES `property_units`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `document_attachments_unitContractId_fkey` FOREIGN KEY (`unitContractId`) REFERENCES `unit_contracts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
