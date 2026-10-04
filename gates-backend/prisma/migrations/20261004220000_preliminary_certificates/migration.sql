-- P1-1: operational preliminary certificates (owner + subcontract), no GL.

CREATE TABLE `owner_preliminary_certificates` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `clientContractId` VARCHAR(191) NOT NULL,
  `projectId` VARCHAR(191) NOT NULL,
  `certificateNumber` VARCHAR(191) NOT NULL,
  `sequenceNumber` INT NOT NULL,
  `periodStartDate` DATETIME(3) NOT NULL,
  `periodEndDate` DATETIME(3) NOT NULL,
  `status` ENUM(
    'DRAFT',
    'SUBMITTED',
    'UNDER_REVIEW',
    'APPROVED',
    'CONVERTED',
    'REJECTED',
    'CANCELLED'
  ) NOT NULL DEFAULT 'DRAFT',
  `grossCurrentWorks` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `previousGrossWorks` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `cumulativeGrossWorks` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `materialsOnSiteCurrent` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `materialsOnSiteDeduction` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `advancePaymentRecovery` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `retentionDeduction` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `engineeringStampsDeduction` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `otherClientPenalties` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `netPayablePreview` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `clientInvoiceId` VARCHAR(191) NULL,
  `createdBy` VARCHAR(191) NULL,
  `submittedAt` DATETIME(3) NULL,
  `submittedBy` VARCHAR(191) NULL,
  `approvedAt` DATETIME(3) NULL,
  `approvedBy` VARCHAR(191) NULL,
  `rejectedAt` DATETIME(3) NULL,
  `rejectedBy` VARCHAR(191) NULL,
  `rejectionReason` TEXT NULL,
  `convertedAt` DATETIME(3) NULL,
  `convertedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `owner_prelim_co_cert_num_uniq`(`companyId`, `certificateNumber`),
  UNIQUE INDEX `owner_prelim_contract_seq_uniq`(`clientContractId`, `sequenceNumber`),
  UNIQUE INDEX `owner_prelim_client_invoice_uniq`(`clientInvoiceId`),
  INDEX `owner_prelim_company_idx`(`companyId`),
  INDEX `owner_prelim_contract_idx`(`clientContractId`),
  INDEX `owner_prelim_project_idx`(`projectId`),
  INDEX `owner_prelim_status_idx`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `owner_preliminary_certificate_lines` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `ownerPreliminaryCertificateId` VARCHAR(191) NOT NULL,
  `projectBOQItemId` VARCHAR(191) NOT NULL,
  `lineOrder` INT NOT NULL DEFAULT 1,
  `itemCodeSnapshot` VARCHAR(191) NOT NULL,
  `descriptionArSnapshot` VARCHAR(191) NOT NULL,
  `unitSnapshot` VARCHAR(20) NOT NULL,
  `contractQuantitySnapshot` DECIMAL(18, 4) NOT NULL,
  `unitRateSnapshot` DECIMAL(18, 4) NOT NULL,
  `previousCertifiedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `requestedCurrentQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `approvedCurrentQuantity` DECIMAL(18, 4) NULL,
  `cumulativeApprovedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `remainingQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `currentAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `cumulativeAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `owner_prelim_line_cert_boq_uniq`(`ownerPreliminaryCertificateId`, `projectBOQItemId`),
  INDEX `owner_prelim_line_company_idx`(`companyId`),
  INDEX `owner_prelim_line_boq_idx`(`projectBOQItemId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `owner_preliminary_certificate_measurements` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `ownerPreliminaryCertificateId` VARCHAR(191) NOT NULL,
  `executiveMeasurementSheetId` VARCHAR(191) NOT NULL,
  `consumedQuantity` DECIMAL(18, 4) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `owner_prelim_meas_sheet_uniq`(`executiveMeasurementSheetId`),
  INDEX `owner_prelim_meas_cert_idx`(`ownerPreliminaryCertificateId`),
  INDEX `owner_prelim_meas_company_idx`(`companyId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `subcontract_preliminary_certificates` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `subcontractId` VARCHAR(191) NOT NULL,
  `certificateNumber` VARCHAR(191) NOT NULL,
  `sequenceNumber` INT NOT NULL,
  `periodStartDate` DATETIME(3) NOT NULL,
  `periodEndDate` DATETIME(3) NOT NULL,
  `status` ENUM(
    'DRAFT',
    'SUBMITTED',
    'UNDER_REVIEW',
    'APPROVED',
    'CONVERTED',
    'REJECTED',
    'CANCELLED'
  ) NOT NULL DEFAULT 'DRAFT',
  `grossCurrentAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `previousGrossAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `grossCumulativeAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `advancePaymentDeduction` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `retentionDeduction` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `taxWithholdingDeduction` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `socialInsuranceDeduction` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `materialOveruseDeduction` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `sitePenaltiesDeduction` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `directExecutionDeduction` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `earlyPaymentDiscountDeduction` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `netPayablePreview` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `subcontractInvoiceId` VARCHAR(191) NULL,
  `createdBy` VARCHAR(191) NULL,
  `submittedAt` DATETIME(3) NULL,
  `submittedBy` VARCHAR(191) NULL,
  `approvedAt` DATETIME(3) NULL,
  `approvedBy` VARCHAR(191) NULL,
  `rejectedAt` DATETIME(3) NULL,
  `rejectedBy` VARCHAR(191) NULL,
  `rejectionReason` TEXT NULL,
  `convertedAt` DATETIME(3) NULL,
  `convertedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `sub_prelim_co_cert_num_uniq`(`companyId`, `certificateNumber`),
  UNIQUE INDEX `sub_prelim_sub_seq_uniq`(`subcontractId`, `sequenceNumber`),
  UNIQUE INDEX `sub_prelim_sub_invoice_uniq`(`subcontractInvoiceId`),
  INDEX `sub_prelim_company_idx`(`companyId`),
  INDEX `sub_prelim_sub_idx`(`subcontractId`),
  INDEX `sub_prelim_status_idx`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `subcontract_preliminary_certificate_lines` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `subcontractPreliminaryCertificateId` VARCHAR(191) NOT NULL,
  `subcontractBOQItemId` VARCHAR(191) NOT NULL,
  `lineOrder` INT NOT NULL DEFAULT 1,
  `itemCodeSnapshot` VARCHAR(191) NOT NULL,
  `descriptionArSnapshot` VARCHAR(191) NOT NULL,
  `unitSnapshot` VARCHAR(20) NOT NULL,
  `contractQuantitySnapshot` DECIMAL(18, 4) NOT NULL,
  `maxAllowedQuantitySnapshot` DECIMAL(18, 4) NOT NULL,
  `unitRateSnapshot` DECIMAL(18, 4) NOT NULL,
  `previousCertifiedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `requestedCurrentQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `approvedCurrentQuantity` DECIMAL(18, 4) NULL,
  `cumulativeApprovedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `remainingQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `currentAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `cumulativeAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `sub_prelim_line_cert_boq_uniq`(`subcontractPreliminaryCertificateId`, `subcontractBOQItemId`),
  INDEX `sub_prelim_line_company_idx`(`companyId`),
  INDEX `sub_prelim_line_boq_idx`(`subcontractBOQItemId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `owner_preliminary_certificates`
  ADD CONSTRAINT `owner_prelim_company_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `owner_prelim_contract_fkey` FOREIGN KEY (`clientContractId`) REFERENCES `client_contracts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `owner_prelim_project_fkey` FOREIGN KEY (`projectId`) REFERENCES `contracting_projects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `owner_preliminary_certificate_lines`
  ADD CONSTRAINT `owner_prelim_line_company_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `owner_prelim_line_cert_fkey` FOREIGN KEY (`ownerPreliminaryCertificateId`) REFERENCES `owner_preliminary_certificates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `owner_prelim_line_boq_fkey` FOREIGN KEY (`projectBOQItemId`) REFERENCES `project_owner_boq_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `owner_preliminary_certificate_measurements`
  ADD CONSTRAINT `owner_prelim_meas_company_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `owner_prelim_meas_cert_fkey` FOREIGN KEY (`ownerPreliminaryCertificateId`) REFERENCES `owner_preliminary_certificates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `owner_prelim_meas_sheet_fkey` FOREIGN KEY (`executiveMeasurementSheetId`) REFERENCES `executive_measurement_sheets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `subcontract_preliminary_certificates`
  ADD CONSTRAINT `sub_prelim_company_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `sub_prelim_sub_fkey` FOREIGN KEY (`subcontractId`) REFERENCES `subcontracts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `subcontract_preliminary_certificate_lines`
  ADD CONSTRAINT `sub_prelim_line_company_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `sub_prelim_line_cert_fkey` FOREIGN KEY (`subcontractPreliminaryCertificateId`) REFERENCES `subcontract_preliminary_certificates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `sub_prelim_line_boq_fkey` FOREIGN KEY (`subcontractBOQItemId`) REFERENCES `subcontract_boq_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `owner_preliminary_certificates`
  ADD CONSTRAINT `owner_prelim_client_invoice_fkey`
  FOREIGN KEY (`clientInvoiceId`) REFERENCES `client_invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `subcontract_preliminary_certificates`
  ADD CONSTRAINT `sub_prelim_sub_invoice_fkey`
  FOREIGN KEY (`subcontractInvoiceId`) REFERENCES `subcontract_invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `contracting_settlement_idempotencies`
  MODIFY `operation` ENUM(
    'CLIENT_INVOICE_COLLECT',
    'SUBCONTRACT_INVOICE_PAY',
    'CLIENT_INVOICE_ALLOCATE',
    'SUBCONTRACT_INVOICE_ALLOCATE',
    'CLIENT_INVOICE_REVERSE',
    'SUBCONTRACT_INVOICE_REVERSE',
    'OWNER_PRELIMINARY_CONVERT',
    'SUBCONTRACT_PRELIMINARY_CONVERT'
  ) NOT NULL;
