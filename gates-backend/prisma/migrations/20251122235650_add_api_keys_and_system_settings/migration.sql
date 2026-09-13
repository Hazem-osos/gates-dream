-- Migration: Add Missing Security & System Models
-- Date: January 2025
-- Description: Adds ApiKey and SystemSetting models for security features

-- API Keys Table
CREATE TABLE IF NOT EXISTS `api_keys` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `key` TEXT NOT NULL COMMENT 'Encrypted API key',
  `keyHash` VARCHAR(64) NOT NULL COMMENT 'SHA-256 hash for lookup',
  `userId` CHAR(36) NULL,
  `companyId` CHAR(36) NULL,
  `tenantId` CHAR(36) NULL,
  `permissions` JSON NOT NULL COMMENT 'Array of permission strings',
  `expiresAt` DATETIME NULL,
  `lastUsedAt` DATETIME NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY `unique_key_hash` (`keyHash`),
  INDEX `idx_user_id` (`userId`),
  INDEX `idx_company_id` (`companyId`),
  INDEX `idx_tenant_id` (`tenantId`),
  INDEX `idx_expires_at` (`expiresAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- System Settings Table
CREATE TABLE IF NOT EXISTS `system_settings` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `key` VARCHAR(255) NOT NULL UNIQUE,
  `value` TEXT NULL,
  `type` VARCHAR(50) NOT NULL DEFAULT 'string' COMMENT 'string, number, boolean, json',
  `category` VARCHAR(100) NULL COMMENT 'grouping category',
  `description` TEXT NULL,
  `isPublic` BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Can be accessed without auth',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX `idx_key` (`key`),
  INDEX `idx_category` (`category`),
  INDEX `idx_is_public` (`isPublic`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

