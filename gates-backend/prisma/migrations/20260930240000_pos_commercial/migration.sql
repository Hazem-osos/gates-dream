-- Commercial POS documents and tenders.
-- Quotations, reservations, coupons, gift cards, and wallets are new rows.
-- Existing posted sales, returns, and drawer totals are not rewritten.
-- A non-EGP payment stores the company rate and the foreign face value.
-- The journal amount stays in EGP. Store credit is not customer.balance.

ALTER TABLE pos_orders
  ADD COLUMN quoteName VARCHAR(80) NULL,
  ADD COLUMN expiresAt DATETIME(3) NULL,
  ADD COLUMN convertedToOrderId VARCHAR(191) NULL,
  ADD COLUMN exchangeGroupId VARCHAR(64) NULL,
  ADD COLUMN couponId VARCHAR(191) NULL,
  ADD COLUMN depositBalance DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN depositJournalId VARCHAR(191) NULL,
  ADD COLUMN receiptToken VARCHAR(64) NULL;

CREATE UNIQUE INDEX pos_orders_converted_to ON pos_orders (convertedToOrderId);
CREATE UNIQUE INDEX pos_orders_receipt_token ON pos_orders (receiptToken);
CREATE INDEX pos_orders_exchange_group ON pos_orders (companyId, exchangeGroupId);

ALTER TABLE pos_payments
  ADD COLUMN exchangeRate DECIMAL(18,6) NOT NULL DEFAULT 1,
  ADD COLUMN foreignAmount DECIMAL(15,2) NULL;

ALTER TABLE pos_settings
  ADD COLUMN blindClose BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN pointsPerAmount DECIMAL(15,4) NULL,
  ADD COLUMN exchangeClearingAccountId VARCHAR(191) NULL,
  ADD COLUMN storeCreditAccountId VARCHAR(191) NULL,
  ADD COLUMN giftCardAccountId VARCHAR(191) NULL,
  ADD COLUMN depositAccountId VARCHAR(191) NULL,
  ADD COLUMN pointsAccountId VARCHAR(191) NULL;

ALTER TABLE pos_terminals
  ADD COLUMN lockedAt DATETIME(3) NULL,
  ADD COLUMN lockedBy VARCHAR(191) NULL;

ALTER TABLE pos_shifts
  ADD COLUMN currentUserId VARCHAR(191) NULL;

ALTER TABLE pos_shift_closes
  ADD COLUMN denominations JSON NULL;

CREATE TABLE pos_coupons (
  id VARCHAR(191) NOT NULL,
  companyId VARCHAR(191) NOT NULL,
  code VARCHAR(40) NOT NULL,
  kind VARCHAR(10) NOT NULL,
  percent DECIMAL(5,2) NULL,
  amount DECIMAL(15,2) NULL,
  minSpend DECIMAL(15,2) NOT NULL DEFAULT 0,
  maxUses INT NULL,
  usedCount INT NOT NULL DEFAULT 0,
  singleUsePerCustomer BOOLEAN NOT NULL DEFAULT false,
  customerId VARCHAR(191) NULL,
  validFrom DATETIME(3) NOT NULL,
  validTo DATETIME(3) NOT NULL,
  isActive BOOLEAN NOT NULL DEFAULT true,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY pos_coupons_company_code (companyId, code),
  CONSTRAINT pos_coupons_company_fk FOREIGN KEY (companyId) REFERENCES companies(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE pos_coupon_redemptions (
  id VARCHAR(191) NOT NULL,
  companyId VARCHAR(191) NOT NULL,
  couponId VARCHAR(191) NOT NULL,
  orderId VARCHAR(191) NOT NULL,
  customerId VARCHAR(191) NULL,
  amount DECIMAL(15,2) NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY pos_coupon_redemptions_order (couponId, orderId),
  CONSTRAINT pos_coupon_redemptions_coupon_fk FOREIGN KEY (couponId) REFERENCES pos_coupons(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE pos_gift_cards (
  id VARCHAR(191) NOT NULL,
  companyId VARCHAR(191) NOT NULL,
  code VARCHAR(40) NOT NULL,
  initialAmount DECIMAL(15,2) NOT NULL,
  balance DECIMAL(15,2) NOT NULL,
  expiresAt DATETIME(3) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  journalEntryId VARCHAR(191) NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY pos_gift_cards_company_code (companyId, code),
  CONSTRAINT pos_gift_cards_company_fk FOREIGN KEY (companyId) REFERENCES companies(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE pos_gift_card_movements (
  id VARCHAR(191) NOT NULL,
  companyId VARCHAR(191) NOT NULL,
  giftCardId VARCHAR(191) NOT NULL,
  kind VARCHAR(20) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  sourceKey VARCHAR(80) NOT NULL,
  orderId VARCHAR(191) NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY pos_gift_card_movements_source (companyId, sourceKey),
  CONSTRAINT pos_gift_card_movements_card_fk FOREIGN KEY (giftCardId) REFERENCES pos_gift_cards(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE pos_wallets (
  id VARCHAR(191) NOT NULL,
  companyId VARCHAR(191) NOT NULL,
  customerId VARCHAR(191) NOT NULL,
  kind VARCHAR(20) NOT NULL,
  balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY pos_wallets_customer_kind (companyId, customerId, kind),
  CONSTRAINT pos_wallets_company_fk FOREIGN KEY (companyId) REFERENCES companies(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE pos_wallet_movements (
  id VARCHAR(191) NOT NULL,
  companyId VARCHAR(191) NOT NULL,
  walletId VARCHAR(191) NOT NULL,
  kind VARCHAR(20) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  sourceKey VARCHAR(80) NOT NULL,
  orderId VARCHAR(191) NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY pos_wallet_movements_source (companyId, sourceKey),
  CONSTRAINT pos_wallet_movements_wallet_fk FOREIGN KEY (walletId) REFERENCES pos_wallets(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE pos_cashier_events (
  id VARCHAR(191) NOT NULL,
  companyId VARCHAR(191) NOT NULL,
  terminalId VARCHAR(191) NOT NULL,
  shiftId VARCHAR(191) NULL,
  kind VARCHAR(20) NOT NULL,
  userId VARCHAR(191) NOT NULL,
  reason VARCHAR(191) NOT NULL,
  metadata JSON NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX pos_cashier_events_terminal (companyId, terminalId, createdAt),
  CONSTRAINT pos_cashier_events_company_fk FOREIGN KEY (companyId) REFERENCES companies(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
