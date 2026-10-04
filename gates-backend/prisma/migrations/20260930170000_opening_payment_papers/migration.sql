-- Opening payment papers are stored with the receipts rule: no issue journal.
ALTER TABLE `securities_payments`
  ADD COLUMN `isOpening` BOOLEAN NOT NULL DEFAULT false;
