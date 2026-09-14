ALTER TABLE `currencies` ADD COLUMN `serial` INTEGER NULL;
ALTER TABLE `currencies` ADD COLUMN `symbol` VARCHAR(16) NULL;

UPDATE `currencies` c
JOIN (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY companyId ORDER BY createdAt ASC, code ASC) AS rn
  FROM `currencies`
) ranked ON ranked.id = c.id
SET c.serial = ranked.rn
WHERE c.serial IS NULL;

CREATE UNIQUE INDEX `currencies_companyId_serial_key` ON `currencies`(`companyId`, `serial`);
