-- Widen location quantities so unit conversions (factor ≠ 1) and large counts
-- do not overflow Decimal(15,3). Additive column change only.
ALTER TABLE `item_quantities`
  MODIFY `quantity` DECIMAL(18, 4) NOT NULL DEFAULT 0;
