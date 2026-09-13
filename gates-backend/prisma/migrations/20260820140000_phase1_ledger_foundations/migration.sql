-- Phase 1 — ledger foundations
-- 1) Unique constraints that were previously only enforced by convention:
--    - accounts: one code per company
--    - invoices: one invoice number per company/branch/fiscalYear/invoiceType
--      (invoiceNumber/invoiceType narrowed to VARCHAR(50)/VARCHAR(20) so the
--      5-column composite index fits MySQL's 3072-byte max key length)
--    - journal_entries.activeSourceKey: at most one *active* (posted) JE per
--      source document (NULL while unposted/historical, so MySQL's
--      "NULLs are distinct" unique-index semantics don't block re-posting).
-- 2) Replace onDelete: Cascade with Restrict on financial-history tables
--    (journal_entries, payment_allocations, item_cost_history,
--    inventory_movements) so a hard delete of a company/item/warehouse/
--    invoice/cashTransaction can never silently wipe out posted ledger,
--    costing, or payment-allocation history.

-- DropForeignKey
ALTER TABLE `inventory_movements` DROP FOREIGN KEY `inventory_movements_companyId_fkey`;

-- DropForeignKey
ALTER TABLE `inventory_movements` DROP FOREIGN KEY `inventory_movements_itemId_fkey`;

-- DropForeignKey
ALTER TABLE `inventory_movements` DROP FOREIGN KEY `inventory_movements_warehouseId_fkey`;

-- DropForeignKey
ALTER TABLE `item_cost_history` DROP FOREIGN KEY `item_cost_history_branchId_fkey`;

-- DropForeignKey
ALTER TABLE `item_cost_history` DROP FOREIGN KEY `item_cost_history_companyId_fkey`;

-- DropForeignKey
ALTER TABLE `item_cost_history` DROP FOREIGN KEY `item_cost_history_itemId_fkey`;

-- DropForeignKey
ALTER TABLE `journal_entries` DROP FOREIGN KEY `journal_entries_companyId_fkey`;

-- DropForeignKey
ALTER TABLE `payment_allocations` DROP FOREIGN KEY `payment_allocations_cashTransactionId_fkey`;

-- DropForeignKey
ALTER TABLE `payment_allocations` DROP FOREIGN KEY `payment_allocations_companyId_fkey`;

-- DropForeignKey
ALTER TABLE `payment_allocations` DROP FOREIGN KEY `payment_allocations_invoiceId_fkey`;

-- DropIndex
DROP INDEX `accounts_code_idx` ON `accounts`;

-- AlterTable
ALTER TABLE `journal_entries` ADD COLUMN `activeSourceKey` VARCHAR(120) NULL;

-- AlterTable
ALTER TABLE `invoices` MODIFY `invoiceNumber` VARCHAR(50) NULL,
    MODIFY `invoiceType` VARCHAR(20) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `accounts_companyId_code_key` ON `accounts`(`companyId`, `code`);

-- CreateIndex
CREATE UNIQUE INDEX `invoices_companyId_branchId_fiscalYearId_invoiceType_invoice_key` ON `invoices`(`companyId`, `branchId`, `fiscalYearId`, `invoiceType`, `invoiceNumber`);

-- CreateIndex
CREATE UNIQUE INDEX `journal_entries_activeSourceKey_key` ON `journal_entries`(`activeSourceKey`);

-- AddForeignKey
ALTER TABLE `journal_entries` ADD CONSTRAINT `journal_entries_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_allocations` ADD CONSTRAINT `payment_allocations_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_allocations` ADD CONSTRAINT `payment_allocations_cashTransactionId_fkey` FOREIGN KEY (`cashTransactionId`) REFERENCES `cash_transactions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_allocations` ADD CONSTRAINT `payment_allocations_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_cost_history` ADD CONSTRAINT `item_cost_history_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_cost_history` ADD CONSTRAINT `item_cost_history_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_cost_history` ADD CONSTRAINT `item_cost_history_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
