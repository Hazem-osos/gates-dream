-- Link shop-floor work orders to manufacturing (production) orders
ALTER TABLE `manufacturing_work_orders`
  ADD COLUMN `productionOrderId` VARCHAR(191) NULL;

CREATE INDEX `manufacturing_work_orders_companyId_productionOrderId_idx`
  ON `manufacturing_work_orders`(`companyId`, `productionOrderId`);

ALTER TABLE `manufacturing_work_orders`
  ADD CONSTRAINT `manufacturing_work_orders_productionOrderId_fkey`
  FOREIGN KEY (`productionOrderId`) REFERENCES `production_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
