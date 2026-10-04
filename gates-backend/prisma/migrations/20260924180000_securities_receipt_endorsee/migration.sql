-- Stores the supplier a receipt paper was endorsed to, so unendorse can reverse that supplier's balance.
ALTER TABLE `securities_receipts`
  ADD COLUMN `endorseeSupplierId` VARCHAR(191) NULL;

CREATE INDEX `securities_receipts_endorseeSupplierId_idx` ON `securities_receipts`(`endorseeSupplierId`);

ALTER TABLE `securities_receipts`
  ADD CONSTRAINT `securities_receipts_endorseeSupplierId_fkey`
  FOREIGN KEY (`endorseeSupplierId`) REFERENCES `suppliers`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
