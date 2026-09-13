-- Phase 4 (M7): header/global discount on top of line discounts, proportionally
-- allocated back to lines for reporting, and posted to the mapped
-- salesDiscount GL account instead of being netted into revenue.
ALTER TABLE `invoices` ADD COLUMN `headerDiscountPercent` DECIMAL(5, 2) NULL;
ALTER TABLE `invoice_lines` ADD COLUMN `headerDiscountAllocated` DECIMAL(18, 4) NULL;
