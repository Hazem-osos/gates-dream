-- Enterprise Subcontractors / Mostakhlassat + Real Estate portfolio overhaul.
-- Legacy Contractor / Extract / RealEstate* tables stay in place.
-- MySQL 8

-- ---------------------------------------------------------------------------
-- Module A — Subcontractors & Mostakhlassat
-- ---------------------------------------------------------------------------

CREATE TABLE `subcontractors` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `nameAr` VARCHAR(191) NOT NULL,
  `nameEn` VARCHAR(191) NULL,
  `taxRegistrationNumber` VARCHAR(191) NULL,
  `commercialRegister` VARCHAR(191) NULL,
  `phone` VARCHAR(191) NULL,
  `email` VARCHAR(191) NULL,
  `address` TEXT NULL,
  `status` ENUM('ACTIVE', 'SUSPENDED', 'BLACKLISTED') NOT NULL DEFAULT 'ACTIVE',
  `bankAccountDetails` JSON NULL,
  `riskScore` DOUBLE NOT NULL DEFAULT 100,
  `legacyContractorId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `subcontractors_companyId_taxRegistrationNumber_key` (`companyId`, `taxRegistrationNumber`),
  INDEX `subcontractors_companyId_status_idx` (`companyId`, `status`),
  INDEX `subcontractors_legacyContractorId_idx` (`legacyContractorId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `subcontracts` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `subcontractNumber` VARCHAR(191) NOT NULL,
  `subcontractorId` VARCHAR(191) NOT NULL,
  `projectId` VARCHAR(191) NOT NULL,
  `contractDate` DATETIME(3) NOT NULL,
  `totalContractValue` DECIMAL(18, 4) NOT NULL,
  `status` ENUM('DRAFT', 'ACTIVE', 'SUSPENDED', 'COMPLETED', 'TERMINATED') NOT NULL DEFAULT 'DRAFT',
  `advancePaymentTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `advancePaymentRecoveryRate` DECIMAL(8, 6) NOT NULL DEFAULT 0.100000,
  `retentionRate` DECIMAL(8, 6) NOT NULL DEFAULT 0.050000,
  `taxWithholdingRate` DECIMAL(8, 6) NOT NULL DEFAULT 0.010000,
  `socialInsuranceRate` DECIMAL(8, 6) NOT NULL DEFAULT 0,
  `maxAllowedVariationOrderRate` DECIMAL(8, 6) NOT NULL DEFAULT 0.200000,
  `standardScrapToleranceRate` DECIMAL(8, 6) NOT NULL DEFAULT 0.050000,
  `contractAdminOverheadRate` DECIMAL(8, 6) NOT NULL DEFAULT 0.150000,
  `earlyPaymentDiscountRate` DECIMAL(8, 6) NOT NULL DEFAULT 0.030000,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `subcontracts_companyId_subcontractNumber_key` (`companyId`, `subcontractNumber`),
  INDEX `subcontracts_subcontractorId_idx` (`subcontractorId`),
  INDEX `subcontracts_projectId_idx` (`projectId`),
  INDEX `subcontracts_status_idx` (`status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `subcontract_boq_items` (
  `id` VARCHAR(191) NOT NULL,
  `subcontractId` VARCHAR(191) NOT NULL,
  `itemCode` VARCHAR(191) NOT NULL,
  `descriptionAr` VARCHAR(191) NOT NULL,
  `descriptionEn` VARCHAR(191) NULL,
  `unit` VARCHAR(20) NOT NULL,
  `contractQuantity` DECIMAL(18, 4) NOT NULL,
  `unitPrice` DECIMAL(18, 4) NOT NULL,
  `totalPrice` DECIMAL(18, 4) NOT NULL,
  `maxAllowedQuantity` DECIMAL(18, 4) NOT NULL,
  `cumulativeExecutedQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `subcontract_boq_items_subcontractId_itemCode_key` (`subcontractId`, `itemCode`),
  INDEX `subcontract_boq_items_subcontractId_idx` (`subcontractId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `subcontract_invoices` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `subcontractId` VARCHAR(191) NOT NULL,
  `invoiceNumber` VARCHAR(191) NOT NULL,
  `sequenceNumber` INTEGER NOT NULL,
  `periodStartDate` DATETIME(3) NOT NULL,
  `periodEndDate` DATETIME(3) NOT NULL,
  `type` ENUM('INTERIM_RUNNING', 'FINAL_SETTLEMENT') NOT NULL DEFAULT 'INTERIM_RUNNING',
  `status` ENUM('DRAFT', 'SITE_SUBMITTED', 'CONSULTANT_APPROVED', 'TECH_OFFICE_APPROVED', 'FINANCE_POSTED', 'REJECTED', 'PAID') NOT NULL DEFAULT 'DRAFT',
  `grossCurrentAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `grossCumulativeAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `previousGrossAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `advancePaymentDeduction` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `retentionDeduction` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `taxWithholdingDeduction` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `socialInsuranceDeduction` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `materialOveruseDeduction` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `sitePenaltiesDeduction` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `directExecutionDeduction` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `earlyPaymentDiscountDeduction` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `netPayableAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `journalEntryId` VARCHAR(191) NULL,
  `attachments` JSON NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `subcontract_invoices_companyId_invoiceNumber_key` (`companyId`, `invoiceNumber`),
  UNIQUE INDEX `subcontract_invoices_subcontractId_sequenceNumber_key` (`subcontractId`, `sequenceNumber`),
  INDEX `subcontract_invoices_subcontractId_idx` (`subcontractId`),
  INDEX `subcontract_invoices_status_idx` (`status`),
  INDEX `subcontract_invoices_journalEntryId_idx` (`journalEntryId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `subcontract_invoice_items` (
  `id` VARCHAR(191) NOT NULL,
  `subcontractInvoiceId` VARCHAR(191) NOT NULL,
  `subcontractBOQItemId` VARCHAR(191) NOT NULL,
  `previousQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `currentQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `totalCumulativeQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `completionPercentage` DECIMAL(8, 4) NOT NULL DEFAULT 0,
  `unitPrice` DECIMAL(18, 4) NOT NULL,
  `totalCurrentAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `sci_items_invoice_boq_key` (`subcontractInvoiceId`, `subcontractBOQItemId`),
  INDEX `subcontract_invoice_items_subcontractInvoiceId_idx` (`subcontractInvoiceId`),
  INDEX `subcontract_invoice_items_subcontractBOQItemId_idx` (`subcontractBOQItemId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `material_reconciliation_logs` (
  `id` VARCHAR(191) NOT NULL,
  `subcontractId` VARCHAR(191) NOT NULL,
  `subcontractInvoiceId` VARCHAR(191) NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `warehouseIssueSlipNumber` VARCHAR(191) NULL,
  `standardEngineeredQty` DECIMAL(18, 4) NOT NULL,
  `actualIssuedQty` DECIMAL(18, 4) NOT NULL,
  `scrapExcessQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `marketPricePerUnit` DECIMAL(18, 4) NOT NULL,
  `adminOverheadPercentage` DECIMAL(8, 6) NOT NULL,
  `totalPenaltyAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `status` ENUM('PENDING_DEDUCTION', 'DEDUCTED', 'WAIVED') NOT NULL DEFAULT 'PENDING_DEDUCTION',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `material_reconciliation_logs_subcontractId_idx` (`subcontractId`),
  INDEX `material_reconciliation_logs_subcontractInvoiceId_idx` (`subcontractInvoiceId`),
  INDEX `material_reconciliation_logs_itemId_idx` (`itemId`),
  INDEX `material_reconciliation_logs_status_idx` (`status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `site_penalties_and_snags` (
  `id` VARCHAR(191) NOT NULL,
  `subcontractId` VARCHAR(191) NOT NULL,
  `subcontractInvoiceId` VARCHAR(191) NULL,
  `penaltyType` ENUM('DELAY_PENALTY', 'NCR_QUALITY_DEFECT', 'HSE_SAFETY_VIOLATION', 'MANPOWER_SHORTAGE', 'EQUIPMENT_DEMURRAGE') NOT NULL,
  `amount` DECIMAL(18, 4) NOT NULL,
  `incidentDate` DATETIME(3) NOT NULL,
  `description` TEXT NOT NULL,
  `consultantReportRef` VARCHAR(191) NULL,
  `status` ENUM('PENDING', 'DISPUTED', 'APPROVED_FOR_DEDUCTION', 'APPLIED_TO_INVOICE') NOT NULL DEFAULT 'PENDING',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `site_penalties_and_snags_subcontractId_idx` (`subcontractId`),
  INDEX `site_penalties_and_snags_subcontractInvoiceId_idx` (`subcontractInvoiceId`),
  INDEX `site_penalties_and_snags_status_idx` (`status`),
  INDEX `site_penalties_and_snags_incidentDate_idx` (`incidentDate`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `direct_execution_charges` (
  `id` VARCHAR(191) NOT NULL,
  `subcontractId` VARCHAR(191) NOT NULL,
  `subcontractInvoiceId` VARCHAR(191) NULL,
  `reason` TEXT NOT NULL,
  `thirdPartyVendorName` VARCHAR(191) NULL,
  `directCostIncurred` DECIMAL(18, 4) NOT NULL,
  `overheadSurchargeRate` DECIMAL(8, 6) NOT NULL,
  `totalDeduction` DECIMAL(18, 4) NOT NULL,
  `status` ENUM('PENDING', 'APPLIED') NOT NULL DEFAULT 'PENDING',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `direct_execution_charges_subcontractId_idx` (`subcontractId`),
  INDEX `direct_execution_charges_subcontractInvoiceId_idx` (`subcontractInvoiceId`),
  INDEX `direct_execution_charges_status_idx` (`status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `subcontractors`
  ADD CONSTRAINT `subcontractors_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `subcontracts`
  ADD CONSTRAINT `subcontracts_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `subcontracts_subcontractorId_fkey` FOREIGN KEY (`subcontractorId`) REFERENCES `subcontractors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `subcontracts_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `contracting_projects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `subcontract_boq_items`
  ADD CONSTRAINT `subcontract_boq_items_subcontractId_fkey` FOREIGN KEY (`subcontractId`) REFERENCES `subcontracts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `subcontract_invoices`
  ADD CONSTRAINT `subcontract_invoices_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `subcontract_invoices_subcontractId_fkey` FOREIGN KEY (`subcontractId`) REFERENCES `subcontracts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `subcontract_invoices_journalEntryId_fkey` FOREIGN KEY (`journalEntryId`) REFERENCES `journal_entries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `subcontract_invoice_items`
  ADD CONSTRAINT `subcontract_invoice_items_subcontractInvoiceId_fkey` FOREIGN KEY (`subcontractInvoiceId`) REFERENCES `subcontract_invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `subcontract_invoice_items_subcontractBOQItemId_fkey` FOREIGN KEY (`subcontractBOQItemId`) REFERENCES `subcontract_boq_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `material_reconciliation_logs`
  ADD CONSTRAINT `material_reconciliation_logs_subcontractId_fkey` FOREIGN KEY (`subcontractId`) REFERENCES `subcontracts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `material_reconciliation_logs_subcontractInvoiceId_fkey` FOREIGN KEY (`subcontractInvoiceId`) REFERENCES `subcontract_invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `material_reconciliation_logs_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `site_penalties_and_snags`
  ADD CONSTRAINT `site_penalties_and_snags_subcontractId_fkey` FOREIGN KEY (`subcontractId`) REFERENCES `subcontracts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `site_penalties_and_snags_subcontractInvoiceId_fkey` FOREIGN KEY (`subcontractInvoiceId`) REFERENCES `subcontract_invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `direct_execution_charges`
  ADD CONSTRAINT `direct_execution_charges_subcontractId_fkey` FOREIGN KEY (`subcontractId`) REFERENCES `subcontracts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `direct_execution_charges_subcontractInvoiceId_fkey` FOREIGN KEY (`subcontractInvoiceId`) REFERENCES `subcontract_invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Module B — Real estate portfolio
-- ---------------------------------------------------------------------------

CREATE TABLE `property_projects` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `projectCode` VARCHAR(191) NOT NULL,
  `nameAr` VARCHAR(191) NOT NULL,
  `nameEn` VARCHAR(191) NULL,
  `location` TEXT NULL,
  `constructionCompletionPct` DECIMAL(8, 4) NOT NULL DEFAULT 0,
  `activePriceMultiplier` DECIMAL(8, 6) NOT NULL DEFAULT 1,
  `costCenterId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `property_projects_companyId_projectCode_key` (`companyId`, `projectCode`),
  INDEX `property_projects_companyId_idx` (`companyId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `property_phases` (
  `id` VARCHAR(191) NOT NULL,
  `projectId` VARCHAR(191) NOT NULL,
  `phaseCode` VARCHAR(191) NOT NULL,
  `nameAr` VARCHAR(191) NOT NULL,
  `nameEn` VARCHAR(191) NULL,
  `location` VARCHAR(191) NULL,
  `constructionCompletionPct` DECIMAL(8, 4) NOT NULL DEFAULT 0,
  `activePriceMultiplier` DECIMAL(8, 6) NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `property_phases_projectId_phaseCode_key` (`projectId`, `phaseCode`),
  INDEX `property_phases_projectId_idx` (`projectId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `property_units` (
  `id` VARCHAR(191) NOT NULL,
  `phaseId` VARCHAR(191) NOT NULL,
  `unitCode` VARCHAR(191) NOT NULL,
  `unitType` ENUM('RESIDENTIAL_APARTMENT', 'VILLA', 'COMMERCIAL_RETAIL', 'OFFICE_ADMIN') NOT NULL DEFAULT 'RESIDENTIAL_APARTMENT',
  `grossArea` DECIMAL(18, 4) NOT NULL,
  `netArea` DECIMAL(18, 4) NOT NULL,
  `floorNumber` INTEGER NOT NULL DEFAULT 0,
  `basePricePerMeter` DECIMAL(18, 4) NOT NULL,
  `premiumModifiersTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `totalPrice` DECIMAL(18, 4) NOT NULL,
  `maintenanceDepositAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `status` ENUM('AVAILABLE', 'RESERVED', 'CONTRACTED', 'DELIVERED', 'BLOCKED') NOT NULL DEFAULT 'AVAILABLE',
  `legacyRealEstateUnitId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `property_units_phaseId_unitCode_key` (`phaseId`, `unitCode`),
  UNIQUE INDEX `property_units_legacyRealEstateUnitId_key` (`legacyRealEstateUnitId`),
  INDEX `property_units_phaseId_status_idx` (`phaseId`, `status`),
  INDEX `property_units_status_idx` (`status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `unit_contracts`
  ADD COLUMN `propertyUnitId` VARCHAR(191) NULL,
  ADD COLUMN `totalSellingPrice` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `maintenanceDeposit` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `paymentPlanType` ENUM('EQUAL_INSTALLMENTS', 'FRONT_LOADED', 'CUSTOM_BALLOON') NOT NULL DEFAULT 'EQUAL_INSTALLMENTS',
  ADD COLUMN `resaleLock` BOOLEAN NOT NULL DEFAULT false,
  MODIFY `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE';

UPDATE `unit_contracts` SET `totalSellingPrice` = `totalContractAmount` WHERE `totalSellingPrice` = 0;
UPDATE `unit_contracts` SET `maintenanceDeposit` = `maintenanceAmount` WHERE `maintenanceDeposit` = 0;

CREATE INDEX `unit_contracts_propertyUnitId_idx` ON `unit_contracts`(`propertyUnitId`);
CREATE INDEX `unit_contracts_status_idx` ON `unit_contracts`(`status`);

ALTER TABLE `unit_installments`
  ADD COLUMN `installmentType` ENUM('RESERVATION_DEPOSIT', 'CONTRACTING_DOWNPAYMENT', 'REGULAR_INSTALLMENT', 'DELIVERY_PAYMENT', 'MAINTENANCE_DEPOSIT', 'ANNUAL_BALLOON') NOT NULL DEFAULT 'REGULAR_INSTALLMENT',
  ADD COLUMN `originalAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `paidAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `balance` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `dailyLateFeeRate` DECIMAL(8, 6) NOT NULL DEFAULT 0.000500,
  ADD COLUMN `accumulatedLateFee` DECIMAL(18, 4) NOT NULL DEFAULT 0;

UPDATE `unit_installments` SET `originalAmount` = `amount`, `balance` = `amount` WHERE `originalAmount` = 0;

CREATE INDEX `unit_installments_dueDate_idx` ON `unit_installments`(`dueDate`);
CREATE INDEX `unit_installments_status_idx` ON `unit_installments`(`status`);

CREATE TABLE `post_dated_cheques` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `unitContractId` VARCHAR(191) NOT NULL,
  `unitInstallmentId` VARCHAR(191) NULL,
  `chequeNumber` VARCHAR(191) NOT NULL,
  `bankName` VARCHAR(191) NOT NULL,
  `drawerName` VARCHAR(191) NOT NULL,
  `chequeDate` DATETIME(3) NOT NULL,
  `amount` DECIMAL(18, 4) NOT NULL,
  `status` ENUM('UNDER_SAFE_CUSTODY', 'DEPOSITED_UNDER_COLLECTION', 'CLEARED_COLLECTED', 'BOUNCED_RETURNED', 'REPLACED_CANCELLED') NOT NULL DEFAULT 'UNDER_SAFE_CUSTODY',
  `collectionDate` DATETIME(3) NULL,
  `bouncedReason` TEXT NULL,
  `journalEntryId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `post_dated_cheques_companyId_chequeNumber_bankName_key` (`companyId`, `chequeNumber`, `bankName`),
  INDEX `post_dated_cheques_unitContractId_idx` (`unitContractId`),
  INDEX `post_dated_cheques_unitInstallmentId_idx` (`unitInstallmentId`),
  INDEX `post_dated_cheques_status_idx` (`status`),
  INDEX `post_dated_cheques_chequeDate_idx` (`chequeDate`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `unit_resale_transfers` (
  `id` VARCHAR(191) NOT NULL,
  `unitContractId` VARCHAR(191) NOT NULL,
  `sellerCustomerId` VARCHAR(191) NOT NULL,
  `newBuyerCustomerId` VARCHAR(191) NOT NULL,
  `currentUnitMarketValue` DECIMAL(18, 4) NOT NULL,
  `assignmentFeeRate` DECIMAL(8, 6) NOT NULL DEFAULT 0.050000,
  `assignmentFeeAmount` DECIMAL(18, 4) NOT NULL,
  `isAssignmentFeePaid` BOOLEAN NOT NULL DEFAULT false,
  `clearanceStatus` ENUM('PENDING_CLEARANCE', 'FINANCIALLY_CLEARED', 'REJECTED') NOT NULL DEFAULT 'PENDING_CLEARANCE',
  `approvedByUserId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `unit_resale_transfers_unitContractId_idx` (`unitContractId`),
  INDEX `unit_resale_transfers_sellerCustomerId_idx` (`sellerCustomerId`),
  INDEX `unit_resale_transfers_newBuyerCustomerId_idx` (`newBuyerCustomerId`),
  INDEX `unit_resale_transfers_clearanceStatus_idx` (`clearanceStatus`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `unit_cancellation_settlements` (
  `id` VARCHAR(191) NOT NULL,
  `unitContractId` VARCHAR(191) NOT NULL,
  `cancellationDate` DATETIME(3) NOT NULL,
  `totalAmountPaidByClient` DECIMAL(18, 4) NOT NULL,
  `forfeiturePenaltyRate` DECIMAL(8, 6) NOT NULL DEFAULT 0.100000,
  `forfeiturePenaltyAmount` DECIMAL(18, 4) NOT NULL,
  `netRefundableToClient` DECIMAL(18, 4) NOT NULL,
  `refundStatus` ENUM('HELD_UNTIL_RESALE', 'PARTIALLY_REFUNDED', 'FULLY_REFUNDED') NOT NULL DEFAULT 'HELD_UNTIL_RESALE',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `unit_cancellation_settlements_unitContractId_idx` (`unitContractId`),
  INDEX `unit_cancellation_settlements_refundStatus_idx` (`refundStatus`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `rental_pool_agreements` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `propertyUnitId` VARCHAR(191) NOT NULL,
  `unitContractId` VARCHAR(191) NULL,
  `ownerCustomerId` VARCHAR(191) NOT NULL,
  `managementFeeRate` DECIMAL(8, 6) NOT NULL DEFAULT 0.120000,
  `startDate` DATETIME(3) NOT NULL,
  `endDate` DATETIME(3) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `rental_pool_agreements_companyId_isActive_idx` (`companyId`, `isActive`),
  INDEX `rental_pool_agreements_propertyUnitId_idx` (`propertyUnitId`),
  INDEX `rental_pool_agreements_unitContractId_idx` (`unitContractId`),
  INDEX `rental_pool_agreements_ownerCustomerId_idx` (`ownerCustomerId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `rental_distributions` (
  `id` VARCHAR(191) NOT NULL,
  `rentalPoolAgreementId` VARCHAR(191) NOT NULL,
  `periodStart` DATETIME(3) NOT NULL,
  `periodEnd` DATETIME(3) NOT NULL,
  `grossRentReceived` DECIMAL(18, 4) NOT NULL,
  `maintenanceOperatingExpense` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `developerManagementFee` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `netDistributedAmount` DECIMAL(18, 4) NOT NULL,
  `distributedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `rental_distributions_rentalPoolAgreementId_idx` (`rentalPoolAgreementId`),
  INDEX `rental_distributions_periodEnd_idx` (`periodEnd`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `property_projects`
  ADD CONSTRAINT `property_projects_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `property_projects_costCenterId_fkey` FOREIGN KEY (`costCenterId`) REFERENCES `cost_centers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `property_phases`
  ADD CONSTRAINT `property_phases_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `property_projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `property_units`
  ADD CONSTRAINT `property_units_phaseId_fkey` FOREIGN KEY (`phaseId`) REFERENCES `property_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `property_units_legacyRealEstateUnitId_fkey` FOREIGN KEY (`legacyRealEstateUnitId`) REFERENCES `real_estate_units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `unit_contracts`
  ADD CONSTRAINT `unit_contracts_propertyUnitId_fkey` FOREIGN KEY (`propertyUnitId`) REFERENCES `property_units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `post_dated_cheques`
  ADD CONSTRAINT `post_dated_cheques_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `post_dated_cheques_unitContractId_fkey` FOREIGN KEY (`unitContractId`) REFERENCES `unit_contracts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `post_dated_cheques_unitInstallmentId_fkey` FOREIGN KEY (`unitInstallmentId`) REFERENCES `unit_installments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `post_dated_cheques_journalEntryId_fkey` FOREIGN KEY (`journalEntryId`) REFERENCES `journal_entries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `unit_resale_transfers`
  ADD CONSTRAINT `unit_resale_transfers_unitContractId_fkey` FOREIGN KEY (`unitContractId`) REFERENCES `unit_contracts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `unit_resale_transfers_sellerCustomerId_fkey` FOREIGN KEY (`sellerCustomerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `unit_resale_transfers_newBuyerCustomerId_fkey` FOREIGN KEY (`newBuyerCustomerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `unit_resale_transfers_approvedByUserId_fkey` FOREIGN KEY (`approvedByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `unit_cancellation_settlements`
  ADD CONSTRAINT `unit_cancellation_settlements_unitContractId_fkey` FOREIGN KEY (`unitContractId`) REFERENCES `unit_contracts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `rental_pool_agreements`
  ADD CONSTRAINT `rental_pool_agreements_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `rental_pool_agreements_propertyUnitId_fkey` FOREIGN KEY (`propertyUnitId`) REFERENCES `property_units`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `rental_pool_agreements_unitContractId_fkey` FOREIGN KEY (`unitContractId`) REFERENCES `unit_contracts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `rental_pool_agreements_ownerCustomerId_fkey` FOREIGN KEY (`ownerCustomerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `rental_distributions`
  ADD CONSTRAINT `rental_distributions_rentalPoolAgreementId_fkey` FOREIGN KEY (`rentalPoolAgreementId`) REFERENCES `rental_pool_agreements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
