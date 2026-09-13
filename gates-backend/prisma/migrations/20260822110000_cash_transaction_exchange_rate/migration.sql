-- Wave 2: carry a real settlement exchange rate on cash transactions so
-- foreign-currency invoice settlements can post a realized FX gain/loss
-- instead of always assuming rate 1.
ALTER TABLE `cash_transactions` ADD COLUMN `exchangeRate` DECIMAL(18, 6) NULL;
