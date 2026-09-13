-- M14 fix (Item 40): optimistic-locking counter on the two documents the
-- audit flagged as "last-write-wins" for concurrent draft edits. Additive,
-- NOT NULL DEFAULT 0 columns — safe for existing rows.
ALTER TABLE `invoices`
  ADD COLUMN `version` INT NOT NULL DEFAULT 0;

ALTER TABLE `journal_entries`
  ADD COLUMN `version` INT NOT NULL DEFAULT 0;
