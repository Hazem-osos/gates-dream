-- Names and cheque numbers already saved twice stay as they are.
-- One lock row per company+kind+value blocks any later duplicate, including a concurrent save.
CREATE TABLE `company_unique_keys` (
    `companyId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(32) NOT NULL,
    `value` VARCHAR(255) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`companyId`, `kind`, `value`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

UPDATE `items`
SET `arabicName` = TRIM(`arabicName`)
WHERE `arabicName` <> TRIM(`arabicName`);

INSERT INTO `company_unique_keys` (`companyId`, `kind`, `value`, `createdAt`)
SELECT `companyId`, 'ITEM_NAME', `nameKey`, CURRENT_TIMESTAMP(3)
FROM (
    SELECT `companyId`, TRIM(`arabicName`) AS `nameKey`
    FROM `items`
    WHERE TRIM(`arabicName`) <> ''
    GROUP BY `companyId`, TRIM(`arabicName`)
) `names`;

UPDATE `securities_receipts`
SET `securityNumber` = NULL
WHERE `securityNumber` IS NOT NULL AND TRIM(`securityNumber`) = '';

UPDATE `securities_receipts`
SET `securityNumber` = TRIM(`securityNumber`)
WHERE `securityNumber` IS NOT NULL AND `securityNumber` <> TRIM(`securityNumber`);

UPDATE `securities_payments`
SET `securityNumber` = NULL
WHERE `securityNumber` IS NOT NULL AND TRIM(`securityNumber`) = '';

UPDATE `securities_payments`
SET `securityNumber` = TRIM(`securityNumber`)
WHERE `securityNumber` IS NOT NULL AND `securityNumber` <> TRIM(`securityNumber`);

UPDATE `cheques`
SET `chequeNumber` = TRIM(`chequeNumber`)
WHERE `chequeNumber` <> TRIM(`chequeNumber`);

UPDATE `post_dated_cheques`
SET `chequeNumber` = TRIM(`chequeNumber`)
WHERE `chequeNumber` <> TRIM(`chequeNumber`);

INSERT INTO `company_unique_keys` (`companyId`, `kind`, `value`, `createdAt`)
SELECT `companyId`, 'CHEQUE_NUMBER', `num`, CURRENT_TIMESTAMP(3)
FROM (
    SELECT `companyId`, TRIM(`securityNumber`) AS `num`
    FROM `securities_receipts`
    WHERE `securityNumber` IS NOT NULL AND TRIM(`securityNumber`) <> ''
    UNION
    SELECT `companyId`, TRIM(`securityNumber`)
    FROM `securities_payments`
    WHERE `securityNumber` IS NOT NULL AND TRIM(`securityNumber`) <> ''
    UNION
    SELECT `companyId`, TRIM(`chequeNumber`)
    FROM `cheques`
    WHERE TRIM(`chequeNumber`) <> ''
    UNION
    SELECT `companyId`, TRIM(`chequeNumber`)
    FROM `post_dated_cheques`
    WHERE TRIM(`chequeNumber`) <> ''
) `nums`;
