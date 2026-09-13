-- Distinguish مندوب / موزع / سائق on the shared delegates table.

ALTER TABLE `delegates`
    ADD COLUMN `role` VARCHAR(20) NOT NULL DEFAULT 'DELEGATE';

CREATE INDEX `delegates_companyId_role_idx` ON `delegates`(`companyId`, `role`);
