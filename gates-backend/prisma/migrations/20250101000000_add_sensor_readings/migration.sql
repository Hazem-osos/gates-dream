-- CreateTable
CREATE TABLE IF NOT EXISTS `sensor_readings` (
    `id` VARCHAR(36) NOT NULL,
    `machine_id` VARCHAR(255) NOT NULL,
    `sensor_type` VARCHAR(255) NOT NULL,
    `value` DECIMAL(15, 4) NOT NULL,
    `unit` VARCHAR(50) NULL,
    `timestamp` DATETIME(3) NOT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`),
    INDEX `idx_machine_sensor` (`machine_id`, `sensor_type`),
    INDEX `idx_timestamp` (`timestamp`),
    INDEX `idx_machine_timestamp` (`machine_id`, `timestamp`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

