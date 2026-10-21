-- Repair Render MySQL after a mistaken migrate resolve --rolled-back on a restored dump.
UPDATE `_prisma_migrations`
SET `rolled_back_at` = NULL,
    `finished_at` = COALESCE(`finished_at`, `started_at`, NOW(3))
WHERE `migration_name` = '20250816120000_wave0_m0_m1_platform_gl';

DELETE FROM `_prisma_migrations` WHERE `finished_at` IS NULL;
