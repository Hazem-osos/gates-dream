-- CreateTable
CREATE TABLE `esign_paired_devices` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `deviceId` VARCHAR(191) NOT NULL,
    `credentialEnc` TEXT NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    `pairedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revokedAt` DATETIME(3) NULL,
    `lastUsedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `esign_paired_devices_companyId_deviceId_key`(`companyId`, `deviceId`),
    INDEX `esign_paired_devices_companyId_status_idx`(`companyId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `esign_pairing_challenges` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `deviceId` VARCHAR(191) NULL,
    `challenge` VARCHAR(128) NOT NULL,
    `credentialEnc` TEXT NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `consumedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `esign_pairing_challenges_companyId_expiresAt_idx`(`companyId`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `eta_signing_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `eInvoiceDocumentId` VARCHAR(191) NOT NULL,
    `deviceId` VARCHAR(191) NOT NULL,
    `documentType` VARCHAR(5) NOT NULL,
    `unsignedPayload` JSON NOT NULL,
    `canonicalPayload` LONGTEXT NOT NULL,
    `contentHash` VARCHAR(64) NOT NULL,
    `nonce` VARCHAR(64) NOT NULL,
    `requestId` VARCHAR(64) NOT NULL,
    `authorization` TEXT NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `consumedAt` DATETIME(3) NULL,
    `submittedAt` DATETIME(3) NULL,
    `status` VARCHAR(20) NOT NULL,
    `cadesBase64` LONGTEXT NULL,
    `certificateThumbprint` VARCHAR(191) NULL,
    `etaStatus` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `eta_signing_sessions_companyId_nonce_key`(`companyId`, `nonce`),
    INDEX `eta_signing_sessions_companyId_status_expiresAt_idx`(`companyId`, `status`, `expiresAt`),
    INDEX `eta_signing_sessions_eInvoiceDocumentId_idx`(`eInvoiceDocumentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `esign_paired_devices` ADD CONSTRAINT `esign_paired_devices_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `esign_pairing_challenges` ADD CONSTRAINT `esign_pairing_challenges_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `eta_signing_sessions` ADD CONSTRAINT `eta_signing_sessions_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
