-- Per-line FX for invoice extras (إضافات وخصومات أخرى).

ALTER TABLE `invoice_adjustments`
  ADD COLUMN `exchangeRate` DECIMAL(18, 6) NULL;
