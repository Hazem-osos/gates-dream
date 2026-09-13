-- M12 fix (Item 40): `cost_center_movements.debit`/`credit` were
-- Decimal(15,2), two decimal places fewer than `journal_entry_lines`'s
-- Decimal(18,4) — this table mirrors journal-entry-line amounts per cost
-- center, so joins/reconciliations between the two were comparing values
-- at mismatched precision, producing spurious rounding drift. Widening a
-- DECIMAL column's precision/scale is safe/non-lossy in MySQL: existing
-- values are reformatted, never truncated.
ALTER TABLE `cost_center_movements`
  MODIFY COLUMN `debit` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  MODIFY COLUMN `credit` DECIMAL(18, 4) NOT NULL DEFAULT 0;
