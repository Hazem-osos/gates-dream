-- Local/pending: industry receipts that require an official delivery mode.
ALTER TABLE `eta_receipt_settings`
  ADD COLUMN `orderDeliveryMode` VARCHAR(30) NULL;
