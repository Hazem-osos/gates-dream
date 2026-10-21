-- Boot-time migrate deploy fails with P3009 when a prior attempt left rows without finished_at.
-- Safe after a full mysqldump restore where schema already matches applied migrations.
DELETE FROM `_prisma_migrations` WHERE `finished_at` IS NULL;
