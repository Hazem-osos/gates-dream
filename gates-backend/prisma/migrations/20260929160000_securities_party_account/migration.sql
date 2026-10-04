-- Optional GL counterparty when the paper is not tied to a customer/supplier card.
ALTER TABLE `securities_receipts` ADD COLUMN `partyAccountId` VARCHAR(191) NULL;
ALTER TABLE `securities_payments` ADD COLUMN `partyAccountId` VARCHAR(191) NULL;
