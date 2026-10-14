-- Internal notes scratchpad on commercial documents (not printed on customer/supplier copies).
ALTER TABLE `price_quotes` ADD COLUMN `internalNotes` JSON NULL;
ALTER TABLE `purchase_orders` ADD COLUMN `internalNotes` JSON NULL;
