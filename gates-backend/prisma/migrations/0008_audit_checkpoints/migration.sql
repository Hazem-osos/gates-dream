-- Checkpoints for tamper-evident audit chain (MySQL version)

CREATE TABLE IF NOT EXISTS `audit_checkpoints` (
  `id` CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  `companyId` CHAR(36) NOT NULL,
  `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `headHash` TEXT NOT NULL,
  `signature` TEXT NULL,
  KEY `audit_checkpoints_companyId_idx` (`companyId`),
  KEY `audit_checkpoints_at_idx` (`at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Note: RLS handled at application level for MySQL
-- Procedures for creating checkpoints and verifying chains are handled at application level
-- due to Prisma migration limitations with DELIMITER

SELECT 'Audit checkpoints table created - procedures handled at application level' AS note;
