-- Wave 2 M14: ETA e-invoice settings & submission documents
-- MySQL 8

CREATE TABLE `e_invoice_settings` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `clientId` VARCHAR(191) NULL,
  `clientSecret` TEXT NULL,
  `tokenPin` VARCHAR(191) NULL,
  `environment` VARCHAR(20) NOT NULL DEFAULT 'PRE_PRODUCTION',
  `issuerTaxId` VARCHAR(191) NULL,
  `issuerName` VARCHAR(191) NULL,
  `activityCode` VARCHAR(191) NULL,
  `apiBaseUrl` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `e_invoice_settings_companyId_key` (`companyId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `e_invoice_documents` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `invoiceId` VARCHAR(191) NULL,
  `posOrderId` VARCHAR(191) NULL,
  `documentType` VARCHAR(5) NOT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  `documentUuid` VARCHAR(191) NULL,
  `submissionUuid` VARCHAR(191) NULL,
  `longId` VARCHAR(191) NULL,
  `publicUrl` TEXT NULL,
  `originalDocumentUuid` VARCHAR(191) NULL,
  `contentHash` VARCHAR(64) NOT NULL,
  `rawPayload` JSON NOT NULL,
  `submissionResponse` JSON NULL,
  `errorDetails` JSON NULL,
  `validationErrors` JSON NULL,
  `dateTimeIssued` DATETIME(3) NULL,
  `dateTimeReceived` DATETIME(3) NULL,
  `submittedAt` DATETIME(3) NULL,
  `cancelledAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `e_invoice_documents_documentUuid_key` (`documentUuid`),
  UNIQUE INDEX `e_invoice_documents_companyId_contentHash_key` (`companyId`, `contentHash`),
  INDEX `e_invoice_documents_companyId_status_idx` (`companyId`, `status`),
  INDEX `e_invoice_documents_invoiceId_idx` (`invoiceId`),
  INDEX `e_invoice_documents_posOrderId_idx` (`posOrderId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
