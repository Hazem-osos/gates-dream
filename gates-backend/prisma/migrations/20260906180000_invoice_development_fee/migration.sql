-- Development fee (رسم تنمية) on invoice header.
-- Rate is optional percent; amount is always stored (default 0) and recomputed server-side.
ALTER TABLE `invoices` ADD COLUMN `developmentFeeRate` DECIMAL(5, 2) NULL;
ALTER TABLE `invoices` ADD COLUMN `developmentFeeAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0;
