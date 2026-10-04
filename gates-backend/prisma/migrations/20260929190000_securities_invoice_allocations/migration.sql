-- Draft invoice allocations on commercial papers (same UX as cash vouchers).
ALTER TABLE `securities_receipts` ADD COLUMN `invoiceAllocations` JSON NULL;
ALTER TABLE `securities_payments` ADD COLUMN `invoiceAllocations` JSON NULL;
