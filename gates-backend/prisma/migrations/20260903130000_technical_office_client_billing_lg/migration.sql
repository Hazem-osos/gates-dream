-- CreateTable
CREATE TABLE `project_owner_boq_items` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `itemCode` VARCHAR(191) NOT NULL,
    `descriptionAr` VARCHAR(191) NOT NULL,
    `descriptionEn` VARCHAR(191) NULL,
    `unit` ENUM('M2', 'M3', 'TON', 'ITEM', 'LM', 'LS') NOT NULL,
    `contractQuantity` DECIMAL(18, 4) NOT NULL,
    `directCostEstimated` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `indirectMarkupRate` DECIMAL(8, 6) NOT NULL DEFAULT 0.20,
    `unitSellingPrice` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `totalSellingPrice` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `cumulativeExecutedQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `status` ENUM('PENDING_PRICING', 'PRICED', 'APPROVED_IN_CONTRACT') NOT NULL DEFAULT 'PENDING_PRICING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `project_owner_boq_items_companyId_idx`(`companyId`),
    INDEX `project_owner_boq_items_projectId_idx`(`projectId`),
    INDEX `project_owner_boq_items_status_idx`(`status`),
    UNIQUE INDEX `project_owner_boq_items_companyId_projectId_itemCode_key`(`companyId`, `projectId`, `itemCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `boq_rate_analysis_items` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `projectBOQItemId` VARCHAR(191) NOT NULL,
    `costElementType` ENUM('MATERIAL', 'LABOR', 'EQUIPMENT', 'SUBCONTRACTOR', 'SITE_EXPENSE') NOT NULL,
    `resourceCode` VARCHAR(191) NULL,
    `descriptionAr` VARCHAR(191) NOT NULL,
    `descriptionEn` VARCHAR(191) NULL,
    `unit` VARCHAR(20) NOT NULL,
    `consumptionQuotaPerUnit` DECIMAL(18, 4) NOT NULL,
    `unitCost` DECIMAL(18, 4) NOT NULL,
    `wasteFactorRate` DECIMAL(8, 6) NOT NULL DEFAULT 0,
    `totalCostPerUnit` DECIMAL(18, 4) NOT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `boq_rate_analysis_items_companyId_idx`(`companyId`),
    INDEX `boq_rate_analysis_items_projectBOQItemId_idx`(`projectBOQItemId`),
    INDEX `boq_rate_analysis_items_costElementType_idx`(`costElementType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `boq_markup_structures` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `projectBOQItemId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `generalOverheadRate` DECIMAL(8, 6) NOT NULL DEFAULT 0.08,
    `siteOverheadRate` DECIMAL(8, 6) NOT NULL DEFAULT 0.05,
    `contingencyRiskRate` DECIMAL(8, 6) NOT NULL DEFAULT 0.03,
    `profitMarginRate` DECIMAL(8, 6) NOT NULL DEFAULT 0.12,
    `contractTaxesRate` DECIMAL(8, 6) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `boq_markup_structures_companyId_idx`(`companyId`),
    INDEX `boq_markup_structures_projectBOQItemId_idx`(`projectBOQItemId`),
    INDEX `boq_markup_structures_projectId_idx`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `executive_measurement_sheets` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `projectBOQItemId` VARCHAR(191) NOT NULL,
    `sheetNumber` VARCHAR(191) NOT NULL,
    `measurementDate` DATETIME(3) NOT NULL,
    `locationZone` VARCHAR(191) NULL,
    `axisGridRef` VARCHAR(191) NULL,
    `statement` TEXT NULL,
    `multiplierCount` DECIMAL(18, 4) NOT NULL DEFAULT 1,
    `dimensionLength` DECIMAL(18, 4) NULL,
    `dimensionWidth` DECIMAL(18, 4) NULL,
    `dimensionHeight` DECIMAL(18, 4) NULL,
    `calculatedGrossQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `deductionQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `netExecutedQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `attachments` JSON NULL,
    `status` ENUM('DRAFT', 'SITE_ENGINEER_VERIFIED', 'CONSULTANT_APPROVED', 'INVOICED_IN_EXTRACT') NOT NULL DEFAULT 'DRAFT',
    `clientInvoiceId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `executive_measurement_sheets_companyId_idx`(`companyId`),
    INDEX `executive_measurement_sheets_projectId_idx`(`projectId`),
    INDEX `executive_measurement_sheets_projectBOQItemId_idx`(`projectBOQItemId`),
    INDEX `executive_measurement_sheets_status_idx`(`status`),
    INDEX `executive_measurement_sheets_clientInvoiceId_idx`(`clientInvoiceId`),
    UNIQUE INDEX `executive_measurement_sheets_companyId_projectId_sheetNumber_key`(`companyId`, `projectId`, `sheetNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `client_contracts` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `contractNumber` VARCHAR(191) NOT NULL,
    `clientCustomerId` VARCHAR(191) NOT NULL,
    `contractDate` DATETIME(3) NOT NULL,
    `totalContractValue` DECIMAL(18, 4) NOT NULL,
    `advancePaymentAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `advanceRecoveryRate` DECIMAL(8, 6) NOT NULL DEFAULT 0,
    `retentionRate` DECIMAL(8, 6) NOT NULL DEFAULT 0.05,
    `engineeringStampsRate` DECIMAL(8, 6) NOT NULL DEFAULT 0.005,
    `status` ENUM('ACTIVE', 'SUSPENDED', 'COMPLETED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `client_contracts_projectId_key`(`projectId`),
    INDEX `client_contracts_companyId_idx`(`companyId`),
    INDEX `client_contracts_status_idx`(`status`),
    INDEX `client_contracts_clientCustomerId_idx`(`clientCustomerId`),
    UNIQUE INDEX `client_contracts_companyId_contractNumber_key`(`companyId`, `contractNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `client_invoices` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `clientContractId` VARCHAR(191) NOT NULL,
    `invoiceNumber` VARCHAR(191) NOT NULL,
    `sequenceNumber` INTEGER NOT NULL,
    `periodStartDate` DATETIME(3) NOT NULL,
    `periodEndDate` DATETIME(3) NOT NULL,
    `type` ENUM('INTERIM', 'FINAL_SETTLEMENT') NOT NULL DEFAULT 'INTERIM',
    `status` ENUM('DRAFT', 'SUBMITTED_TO_CLIENT', 'CLIENT_APPROVED', 'FINANCE_POSTED', 'REJECTED', 'PAID') NOT NULL DEFAULT 'DRAFT',
    `grossCurrentWorks` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `previousGrossWorks` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `cumulativeGrossWorks` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `materialsOnSiteCurrent` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `materialsOnSiteDeduction` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `advancePaymentRecovery` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `retentionDeduction` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `engineeringStampsDeduction` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `otherClientPenalties` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `netPayableByClient` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `journalEntryId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `client_invoices_companyId_idx`(`companyId`),
    INDEX `client_invoices_clientContractId_idx`(`clientContractId`),
    INDEX `client_invoices_status_idx`(`status`),
    INDEX `client_invoices_journalEntryId_idx`(`journalEntryId`),
    UNIQUE INDEX `client_invoices_companyId_invoiceNumber_key`(`companyId`, `invoiceNumber`),
    UNIQUE INDEX `client_invoices_clientContractId_sequenceNumber_key`(`clientContractId`, `sequenceNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `client_invoice_items` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `clientInvoiceId` VARCHAR(191) NOT NULL,
    `projectBOQItemId` VARCHAR(191) NOT NULL,
    `previousQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `currentQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `cumulativeQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `unitSellingPrice` DECIMAL(18, 4) NOT NULL,
    `currentAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `client_invoice_items_companyId_idx`(`companyId`),
    INDEX `client_invoice_items_clientInvoiceId_idx`(`clientInvoiceId`),
    INDEX `client_invoice_items_projectBOQItemId_idx`(`projectBOQItemId`),
    UNIQUE INDEX `cli_items_invoice_boq_key`(`clientInvoiceId`, `projectBOQItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `site_stock_materials` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `clientInvoiceId` VARCHAR(191) NULL,
    `materialDescription` VARCHAR(191) NOT NULL,
    `deliveryDate` DATETIME(3) NOT NULL,
    `warehouseReceiptRef` VARCHAR(191) NULL,
    `deliveredQuantity` DECIMAL(18, 4) NOT NULL,
    `unitPrice` DECIMAL(18, 4) NOT NULL,
    `approvedPercentage` DECIMAL(8, 6) NOT NULL DEFAULT 0.75,
    `netClaimedAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `status` ENUM('STORED_ON_SITE', 'INSTALLED_AND_DEDUCTED', 'REJECTED') NOT NULL DEFAULT 'STORED_ON_SITE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `site_stock_materials_companyId_idx`(`companyId`),
    INDEX `site_stock_materials_projectId_idx`(`projectId`),
    INDEX `site_stock_materials_status_idx`(`status`),
    INDEX `site_stock_materials_clientInvoiceId_idx`(`clientInvoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_letters_of_guarantee` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `lgNumber` VARCHAR(191) NOT NULL,
    `bankAccountId` VARCHAR(191) NOT NULL,
    `bankName` VARCHAR(191) NOT NULL,
    `beneficiaryName` VARCHAR(191) NOT NULL,
    `type` ENUM('BID_BOND_INITIAL', 'ADVANCE_PAYMENT_BOND', 'PERFORMANCE_BOND_FINAL', 'RETENTION_RELEASE_BOND') NOT NULL,
    `issuanceDate` DATETIME(3) NOT NULL,
    `expiryDate` DATETIME(3) NOT NULL,
    `originalAmount` DECIMAL(18, 4) NOT NULL,
    `currentAmount` DECIMAL(18, 4) NOT NULL,
    `cashMarginRate` DECIMAL(8, 6) NOT NULL,
    `cashMarginAmount` DECIMAL(18, 4) NOT NULL,
    `issuanceCommissionAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE_ISSUED', 'EXTENDED', 'AMENDED_VALUE', 'RELEASED_RETURNED', 'LIQUIDATED_CONFISCATED') NOT NULL DEFAULT 'ACTIVE_ISSUED',
    `journalEntryId` VARCHAR(191) NULL,
    `renewalCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `project_letters_of_guarantee_companyId_idx`(`companyId`),
    INDEX `project_letters_of_guarantee_projectId_idx`(`projectId`),
    INDEX `project_letters_of_guarantee_status_idx`(`status`),
    INDEX `project_letters_of_guarantee_bankAccountId_idx`(`bankAccountId`),
    INDEX `project_letters_of_guarantee_expiryDate_idx`(`expiryDate`),
    INDEX `project_letters_of_guarantee_journalEntryId_idx`(`journalEntryId`),
    UNIQUE INDEX `project_letters_of_guarantee_companyId_lgNumber_key`(`companyId`, `lgNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lg_action_histories` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `letterOfGuaranteeId` VARCHAR(191) NOT NULL,
    `actionType` ENUM('ISSUANCE', 'EXTENSION', 'VALUE_INCREASE', 'VALUE_DECREASE', 'RELEASE_RETURN', 'LIQUIDATION') NOT NULL,
    `actionDate` DATETIME(3) NOT NULL,
    `previousExpiryDate` DATETIME(3) NULL,
    `newExpiryDate` DATETIME(3) NULL,
    `previousAmount` DECIMAL(18, 4) NULL,
    `newAmount` DECIMAL(18, 4) NULL,
    `bankReferenceNo` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `lg_action_histories_companyId_idx`(`companyId`),
    INDEX `lg_action_histories_letterOfGuaranteeId_idx`(`letterOfGuaranteeId`),
    INDEX `lg_action_histories_actionType_idx`(`actionType`),
    INDEX `lg_action_histories_actionDate_idx`(`actionDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `project_owner_boq_items` ADD CONSTRAINT `project_owner_boq_items_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_owner_boq_items` ADD CONSTRAINT `project_owner_boq_items_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `contracting_projects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `boq_rate_analysis_items` ADD CONSTRAINT `boq_rate_analysis_items_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `boq_rate_analysis_items` ADD CONSTRAINT `boq_rate_analysis_items_projectBOQItemId_fkey` FOREIGN KEY (`projectBOQItemId`) REFERENCES `project_owner_boq_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `boq_markup_structures` ADD CONSTRAINT `boq_markup_structures_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `boq_markup_structures` ADD CONSTRAINT `boq_markup_structures_projectBOQItemId_fkey` FOREIGN KEY (`projectBOQItemId`) REFERENCES `project_owner_boq_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `boq_markup_structures` ADD CONSTRAINT `boq_markup_structures_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `contracting_projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `executive_measurement_sheets` ADD CONSTRAINT `executive_measurement_sheets_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `executive_measurement_sheets` ADD CONSTRAINT `executive_measurement_sheets_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `contracting_projects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `executive_measurement_sheets` ADD CONSTRAINT `executive_measurement_sheets_projectBOQItemId_fkey` FOREIGN KEY (`projectBOQItemId`) REFERENCES `project_owner_boq_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `executive_measurement_sheets` ADD CONSTRAINT `executive_measurement_sheets_clientInvoiceId_fkey` FOREIGN KEY (`clientInvoiceId`) REFERENCES `client_invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_contracts` ADD CONSTRAINT `client_contracts_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_contracts` ADD CONSTRAINT `client_contracts_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `contracting_projects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_contracts` ADD CONSTRAINT `client_contracts_clientCustomerId_fkey` FOREIGN KEY (`clientCustomerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_invoices` ADD CONSTRAINT `client_invoices_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_invoices` ADD CONSTRAINT `client_invoices_clientContractId_fkey` FOREIGN KEY (`clientContractId`) REFERENCES `client_contracts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_invoices` ADD CONSTRAINT `client_invoices_journalEntryId_fkey` FOREIGN KEY (`journalEntryId`) REFERENCES `journal_entries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_invoice_items` ADD CONSTRAINT `client_invoice_items_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_invoice_items` ADD CONSTRAINT `client_invoice_items_clientInvoiceId_fkey` FOREIGN KEY (`clientInvoiceId`) REFERENCES `client_invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_invoice_items` ADD CONSTRAINT `client_invoice_items_projectBOQItemId_fkey` FOREIGN KEY (`projectBOQItemId`) REFERENCES `project_owner_boq_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `site_stock_materials` ADD CONSTRAINT `site_stock_materials_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `site_stock_materials` ADD CONSTRAINT `site_stock_materials_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `contracting_projects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `site_stock_materials` ADD CONSTRAINT `site_stock_materials_clientInvoiceId_fkey` FOREIGN KEY (`clientInvoiceId`) REFERENCES `client_invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_letters_of_guarantee` ADD CONSTRAINT `project_letters_of_guarantee_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_letters_of_guarantee` ADD CONSTRAINT `project_letters_of_guarantee_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `contracting_projects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_letters_of_guarantee` ADD CONSTRAINT `project_letters_of_guarantee_bankAccountId_fkey` FOREIGN KEY (`bankAccountId`) REFERENCES `bank_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_letters_of_guarantee` ADD CONSTRAINT `project_letters_of_guarantee_journalEntryId_fkey` FOREIGN KEY (`journalEntryId`) REFERENCES `journal_entries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lg_action_histories` ADD CONSTRAINT `lg_action_histories_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lg_action_histories` ADD CONSTRAINT `lg_action_histories_letterOfGuaranteeId_fkey` FOREIGN KEY (`letterOfGuaranteeId`) REFERENCES `project_letters_of_guarantee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
