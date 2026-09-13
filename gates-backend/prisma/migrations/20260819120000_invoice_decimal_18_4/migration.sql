-- Invoice header & line monetary fields → DECIMAL(18,4) for ERP precision.
-- Run via: npx prisma migrate deploy (after placing this under prisma/migrations).

ALTER TABLE `invoices`
  MODIFY `totalAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  MODIFY `discountAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  MODIFY `taxAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  MODIFY `withholdingTaxAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  MODIFY `netAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  MODIFY `paidAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  MODIFY `remainingAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0;

ALTER TABLE `invoice_lines`
  MODIFY `quantity` DECIMAL(18, 4) NOT NULL,
  MODIFY `baseQuantity` DECIMAL(18, 4) NOT NULL,
  MODIFY `price` DECIMAL(18, 4) NOT NULL,
  MODIFY `total` DECIMAL(18, 4) NOT NULL,
  MODIFY `discountAmount` DECIMAL(18, 4) NULL,
  MODIFY `taxAmount` DECIMAL(18, 4) NULL;
