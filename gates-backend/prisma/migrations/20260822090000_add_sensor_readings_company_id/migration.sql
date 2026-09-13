-- Wave 1 (zero-defect gap closure): sensor_readings had no companyId at all, so any
-- tenant able to name another tenant's machineId could read its IoT sensor history.
-- Nullable: no Machine model links machineId to a company to backfill existing rows from.
-- New rows always set it going forward; legacy NULL rows become invisible under any
-- tenant filter, which is the safe default for data with no recoverable ownership.
--
-- Note: the live table's actual columns are camelCase (`machineId`, `sensorType`, ...),
-- matching Prisma's default column naming (no @map on this model) rather than the
-- snake_case columns the original 20250101000000_add_sensor_readings migration.sql
-- described — this migration targets the columns/index names that actually exist.
ALTER TABLE `sensor_readings` ADD COLUMN `companyId` CHAR(36) NULL AFTER `id`;

DROP INDEX `sensor_readings_machineId_sensorType_idx` ON `sensor_readings`;
DROP INDEX `sensor_readings_machineId_timestamp_idx` ON `sensor_readings`;

CREATE INDEX `sensor_readings_companyId_machineId_sensorType_idx` ON `sensor_readings`(`companyId`, `machineId`, `sensorType`);
CREATE INDEX `sensor_readings_companyId_machineId_timestamp_idx` ON `sensor_readings`(`companyId`, `machineId`, `timestamp`);
