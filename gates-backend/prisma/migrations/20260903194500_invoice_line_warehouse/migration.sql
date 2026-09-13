-- Per-line warehouse so invoice items can issue/receive from different stores.
-- Null falls back to invoices.warehouseId (header default).

ALTER TABLE `invoice_lines`
    ADD COLUMN `warehouseId` VARCHAR(191) NULL;

CREATE INDEX `invoice_lines_warehouseId_idx` ON `invoice_lines`(`warehouseId`);

ALTER TABLE `invoice_lines`
    ADD CONSTRAINT `invoice_lines_warehouseId_fkey`
    FOREIGN KEY (`warehouseId`) REFERENCES `warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
