-- Reservation fulfillment tracking + link from issue / sales invoice lines

ALTER TABLE `item_reservations`
  ADD COLUMN `fulfilledQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0 AFTER `quantity`;

ALTER TABLE `issue_lines`
  ADD COLUMN `itemReservationId` VARCHAR(191) NULL AFTER `itemId`,
  ADD COLUMN `reservationFulfillQuantity` DECIMAL(18, 4) NULL AFTER `itemReservationId`;

ALTER TABLE `invoice_lines`
  ADD COLUMN `itemReservationId` VARCHAR(191) NULL AFTER `itemId`,
  ADD COLUMN `reservationFulfillQuantity` DECIMAL(18, 4) NULL AFTER `itemReservationId`;

CREATE INDEX `issue_lines_itemReservationId_idx` ON `issue_lines`(`itemReservationId`);
CREATE INDEX `invoice_lines_itemReservationId_idx` ON `invoice_lines`(`itemReservationId`);
