ALTER TABLE pos_orders
  ADD COLUMN clientRequestId VARCHAR(64) NULL,
  ADD COLUMN voidedAt DATETIME(3) NULL,
  ADD COLUMN voidedBy VARCHAR(191) NULL,
  ADD COLUMN voidReason TEXT NULL,
  ADD COLUMN voidJournalEntryId VARCHAR(191) NULL;

CREATE UNIQUE INDEX pos_orders_company_client_request ON pos_orders (companyId, clientRequestId);

ALTER TABLE pos_order_lines
  ADD COLUMN isGift BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN offerId VARCHAR(191) NULL,
  ADD COLUMN batchNumber VARCHAR(64) NULL,
  ADD COLUMN expiryDate DATETIME(3) NULL,
  ADD COLUMN serialNo VARCHAR(64) NULL;

ALTER TABLE pos_payments
  ADD COLUMN captureStatus VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN provider VARCHAR(40) NULL,
  ADD COLUMN providerRef VARCHAR(120) NULL;

ALTER TABLE pos_payment_methods
  ADD COLUMN captureMode VARCHAR(20) NOT NULL DEFAULT 'MANUAL';

ALTER TABLE pos_terminals
  ADD COLUMN receiptFooter VARCHAR(191) NULL,
  ADD COLUMN offlineEnabled BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE pos_settings (
  id VARCHAR(191) NOT NULL,
  companyId VARCHAR(191) NOT NULL,
  varianceTolerance DECIMAL(15,2) NOT NULL DEFAULT 0,
  varianceRequiresApproval BOOLEAN NOT NULL DEFAULT false,
  discountApprovalPercent DECIMAL(5,2) NULL,
  priceOverrideRequiresApproval BOOLEAN NOT NULL DEFAULT false,
  returnRequiresApproval BOOLEAN NOT NULL DEFAULT false,
  receiptFooter VARCHAR(191) NULL,
  offlineEnabled BOOLEAN NOT NULL DEFAULT false,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY pos_settings_company (companyId),
  CONSTRAINT pos_settings_company_fk FOREIGN KEY (companyId) REFERENCES companies(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE pos_barcode_rules (
  id VARCHAR(191) NOT NULL,
  companyId VARCHAR(191) NOT NULL,
  name VARCHAR(80) NOT NULL,
  prefix VARCHAR(8) NOT NULL,
  itemStart INTEGER NOT NULL,
  itemLength INTEGER NOT NULL,
  valueStart INTEGER NOT NULL,
  valueLength INTEGER NOT NULL,
  valueKind VARCHAR(10) NOT NULL,
  decimals INTEGER NOT NULL DEFAULT 3,
  isActive BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (id),
  INDEX pos_barcode_rules_company (companyId, isActive),
  CONSTRAINT pos_barcode_rules_company_fk FOREIGN KEY (companyId) REFERENCES companies(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE pos_approvals (
  id VARCHAR(191) NOT NULL,
  companyId VARCHAR(191) NOT NULL,
  action VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  requesterId VARCHAR(191) NOT NULL,
  approverId VARCHAR(191) NULL,
  reason VARCHAR(191) NOT NULL,
  shiftId VARCHAR(191) NULL,
  orderId VARCHAR(191) NULL,
  payload JSON NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  decidedAt DATETIME(3) NULL,
  PRIMARY KEY (id),
  INDEX pos_approvals_company (companyId, status, action),
  CONSTRAINT pos_approvals_company_fk FOREIGN KEY (companyId) REFERENCES companies(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE pos_credit_collections (
  id VARCHAR(191) NOT NULL,
  companyId VARCHAR(191) NOT NULL,
  customerId VARCHAR(191) NOT NULL,
  shiftId VARCHAR(191) NULL,
  amount DECIMAL(15,2) NOT NULL,
  safeId VARCHAR(191) NULL,
  journalEntryId VARCHAR(191) NULL,
  collectedBy VARCHAR(191) NOT NULL,
  notes VARCHAR(191) NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX pos_credit_collections_customer (companyId, customerId),
  CONSTRAINT pos_credit_collections_company_fk FOREIGN KEY (companyId) REFERENCES companies(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE pos_shift_templates (
  id VARCHAR(191) NOT NULL,
  companyId VARCHAR(191) NOT NULL,
  name VARCHAR(80) NOT NULL,
  isActive BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (id),
  UNIQUE KEY pos_shift_templates_name (companyId, name),
  CONSTRAINT pos_shift_templates_company_fk FOREIGN KEY (companyId) REFERENCES companies(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE item_barcodes (
  id VARCHAR(191) NOT NULL,
  companyId VARCHAR(191) NOT NULL,
  itemId VARCHAR(191) NOT NULL,
  unitId VARCHAR(191) NOT NULL,
  barcode VARCHAR(64) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY item_barcodes_code (companyId, barcode),
  INDEX item_barcodes_item (itemId),
  CONSTRAINT item_barcodes_company_fk FOREIGN KEY (companyId) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT item_barcodes_item_fk FOREIGN KEY (itemId) REFERENCES items(id) ON DELETE CASCADE,
  CONSTRAINT item_barcodes_unit_fk FOREIGN KEY (unitId) REFERENCES units(id) ON DELETE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE inventory_item_lots (
  id VARCHAR(191) NOT NULL,
  companyId VARCHAR(191) NOT NULL,
  itemId VARCHAR(191) NOT NULL,
  warehouseId VARCHAR(191) NOT NULL,
  batchNumber VARCHAR(64) NOT NULL,
  expiryDate DATETIME(3) NULL,
  quantity DECIMAL(18,4) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY inventory_item_lots_key (companyId, itemId, warehouseId, batchNumber),
  INDEX inventory_item_lots_expiry (companyId, expiryDate),
  CONSTRAINT inventory_item_lots_item_fk FOREIGN KEY (itemId) REFERENCES items(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE inventory_item_serials (
  id VARCHAR(191) NOT NULL,
  companyId VARCHAR(191) NOT NULL,
  itemId VARCHAR(191) NOT NULL,
  warehouseId VARCHAR(191) NULL,
  serial VARCHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
  posOrderLineId VARCHAR(191) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY inventory_item_serials_key (companyId, itemId, serial),
  INDEX inventory_item_serials_status (companyId, status),
  CONSTRAINT inventory_item_serials_item_fk FOREIGN KEY (itemId) REFERENCES items(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
