-- AlterTable
ALTER TABLE `cash_transactions`
    ADD COLUMN `bankReference` VARCHAR(191) NULL,
    ADD COLUMN `valueDate` DATETIME(3) NULL;
