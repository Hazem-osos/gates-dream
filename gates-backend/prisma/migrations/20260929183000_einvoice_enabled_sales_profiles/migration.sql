-- Which sales invoice patterns appear on the e-invoice send screen.
ALTER TABLE `e_invoice_settings` ADD COLUMN `enabledSalesProfileIds` JSON NULL;
