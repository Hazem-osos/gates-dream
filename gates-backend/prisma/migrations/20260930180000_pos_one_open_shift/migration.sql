-- One OPEN operational session per terminal.
-- openTerminalKey is the terminal id while OPEN and NULL when CLOSED.
-- MySQL unique indexes treat NULLs as distinct, so closed sessions do not collide.
--
-- Prisma runs each statement separately, so this cannot use a stored procedure.
-- The preflight table is the abort: inserting every OPEN row into a unique
-- (companyId, terminalId) key fails with ER_DUP_ENTRY before pos_shifts changes
-- when two OPEN rows already share a terminal. It does not close or delete them.
-- Run scripts/pos-open-shift-preflight.ts first to see the conflicting ids.
-- A failed run leaves only pos_shift_open_preflight; the next attempt drops it.

DROP TABLE IF EXISTS `pos_shift_open_preflight`;

CREATE TABLE `pos_shift_open_preflight` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `terminalId` VARCHAR(191) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pos_shift_open_preflight_terminal` (`companyId`, `terminalId`)
);

INSERT INTO `pos_shift_open_preflight` (`id`, `companyId`, `terminalId`)
SELECT `id`, `companyId`, `terminalId`
FROM `pos_shifts`
WHERE `status` = 'OPEN';

ALTER TABLE `pos_shifts` ADD COLUMN `openTerminalKey` VARCHAR(191) NULL;

UPDATE `pos_shifts`
SET `openTerminalKey` = `terminalId`
WHERE `status` = 'OPEN' AND `openTerminalKey` IS NULL;

CREATE UNIQUE INDEX `pos_shifts_one_open_per_terminal` ON `pos_shifts`(`companyId`, `openTerminalKey`);

DROP TABLE IF EXISTS `pos_shift_open_preflight`;
