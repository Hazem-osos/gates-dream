-- Promote Cheque.direction / Cheque.status from VARCHAR to Prisma enums.
-- Legacy values: IN_PORTFOLIO + ISSUED → UNDER_HAND, CLEARED → COLLECTED.

UPDATE `cheques` SET `status` = 'UNDER_HAND' WHERE `status` IN ('IN_PORTFOLIO', 'ISSUED');
UPDATE `cheques` SET `status` = 'COLLECTED' WHERE `status` = 'CLEARED';
UPDATE `cheques`
  SET `status` = 'CANCELLED'
  WHERE `status` NOT IN (
    'UNDER_HAND',
    'SENT_TO_BANK',
    'COLLECTED',
    'ENDORSED',
    'BOUNCED',
    'RETURNED_TO_DRAWER',
    'CANCELLED'
  );

ALTER TABLE `cheques`
  MODIFY COLUMN `direction` ENUM('INWARD', 'OUTWARD') NOT NULL,
  MODIFY COLUMN `status` ENUM('UNDER_HAND', 'SENT_TO_BANK', 'COLLECTED', 'ENDORSED', 'BOUNCED', 'RETURNED_TO_DRAWER', 'CANCELLED') NOT NULL;

CREATE INDEX `cheques_companyId_direction_status_idx` ON `cheques`(`companyId`, `direction`, `status`);
