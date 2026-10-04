-- PREPRODUCTION manual test receipts (no PosOrder). Production POS flow unchanged.

ALTER TABLE `eta_receipts`
  MODIFY `posOrderId` VARCHAR(191) NULL,
  ADD COLUMN `issueSource` VARCHAR(32) NOT NULL DEFAULT 'POS',
  ADD COLUMN `testClientKey` VARCHAR(64) NULL;

CREATE UNIQUE INDEX `eta_receipts_company_test_client` ON `eta_receipts` (`companyId`, `testClientKey`);

ALTER TABLE `eta_receipts`
  DROP FOREIGN KEY `eta_receipts_order_fkey`;

ALTER TABLE `eta_receipts`
  ADD CONSTRAINT `eta_receipts_posOrderId_fkey`
  FOREIGN KEY (`posOrderId`) REFERENCES `pos_orders` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
