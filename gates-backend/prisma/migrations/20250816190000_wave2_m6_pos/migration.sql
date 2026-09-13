-- Wave 2 M6: Point of Sale
-- MySQL 8

CREATE TABLE `pos_terminals` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `branchId` VARCHAR(191) NOT NULL,
  `warehouseId` VARCHAR(191) NOT NULL,
  `safeId` VARCHAR(191) NOT NULL,
  `bankAccountId` VARCHAR(191) NULL,
  `defaultCustomerId` VARCHAR(191) NULL,
  `name` VARCHAR(191) NOT NULL,
  `deviceCode` VARCHAR(191) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `pos_terminals_companyId_deviceCode_key` (`companyId`, `deviceCode`),
  INDEX `pos_terminals_companyId_branchId_idx` (`companyId`, `branchId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `pos_shifts` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `branchId` VARCHAR(191) NOT NULL,
  `fiscalYearId` VARCHAR(191) NULL,
  `terminalId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `shiftNumber` VARCHAR(191) NULL,
  `status` VARCHAR(10) NOT NULL DEFAULT 'OPEN',
  `openedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `closedAt` DATETIME(3) NULL,
  `openingCash` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `closingCashDeclared` DECIMAL(15, 2) NULL,
  `closingCashSystem` DECIMAL(15, 2) NULL,
  `cashVariance` DECIMAL(15, 2) NULL,
  `totalCashSales` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `totalCardSales` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `totalCreditSales` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `totalMerchandise` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `totalTaxAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `totalCogs` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `endOfDayJournalEntryId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `pos_shifts_companyId_terminalId_status_idx` (`companyId`, `terminalId`, `status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `pos_orders` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `shiftId` VARCHAR(191) NOT NULL,
  `orderNumber` VARCHAR(191) NOT NULL,
  `orderType` VARCHAR(20) NOT NULL DEFAULT 'SALE',
  `originalOrderId` VARCHAR(191) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  `customerId` VARCHAR(191) NULL,
  `barcodeRef` VARCHAR(191) NULL,
  `totalAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `discountAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `taxAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `netAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `cashAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `cardAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `creditAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `paymentMethod` VARCHAR(20) NOT NULL,
  `currencyCode` VARCHAR(10) NOT NULL DEFAULT 'EGP',
  `postedAt` DATETIME(3) NULL,
  `postedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `pos_orders_companyId_orderNumber_key` (`companyId`, `orderNumber`),
  INDEX `pos_orders_shiftId_status_idx` (`shiftId`, `status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `pos_order_lines` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `unitId` VARCHAR(191) NOT NULL,
  `quantity` DECIMAL(15, 4) NOT NULL,
  `price` DECIMAL(15, 4) NOT NULL,
  `discountAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `taxPercent` DECIMAL(8, 4) NOT NULL DEFAULT 0,
  `taxAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `lineTotal` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `unitCost` DECIMAL(15, 4) NOT NULL DEFAULT 0,
  `lineOrder` INT NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `pos_order_lines_orderId_idx` (`orderId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
