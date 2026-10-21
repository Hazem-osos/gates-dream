-- Repair restored MySQL after failed deploy / mistaken migrate resolve --rolled-back.
UPDATE `_prisma_migrations`
SET `rolled_back_at` = NULL,
    `finished_at` = COALESCE(`finished_at`, `started_at`, NOW(3))
WHERE `rolled_back_at` IS NOT NULL OR `finished_at` IS NULL;

DELETE FROM `_prisma_migrations` WHERE `finished_at` IS NULL;
