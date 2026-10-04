-- P0-2.1: Durable idempotency for contracting treasury settlement requests.

CREATE TABLE `contracting_settlement_idempotencies` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `operation` ENUM('CLIENT_INVOICE_COLLECT', 'SUBCONTRACT_INVOICE_PAY', 'CLIENT_INVOICE_ALLOCATE', 'SUBCONTRACT_INVOICE_ALLOCATE') NOT NULL,
    `idempotencyKey` VARCHAR(128) NOT NULL,
    `requestFingerprint` VARCHAR(64) NOT NULL,
    `status` ENUM('PENDING', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
    `cashTransactionId` VARCHAR(191) NULL,
    `allocationId` VARCHAR(191) NULL,
    `resultJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `csi_co_op_key_uniq`(`companyId`, `operation`, `idempotencyKey`),
    INDEX `csi_co_op_idx`(`companyId`, `operation`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `contracting_settlement_idempotencies` ADD CONSTRAINT `csi_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
