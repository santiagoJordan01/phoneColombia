-- Ejecutar en phpMyAdmin → u949210655_Phone (una sola vez)
-- Crea la tabla device_brands faltante en producción

CREATE TABLE IF NOT EXISTS `device_brands` (
  `id` char(36) NOT NULL,
  `name` varchar(80) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `device_brands_name_unique` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `device_brands` (`id`, `name`, `created_at`, `updated_at`) VALUES
(UUID(), 'IPHONE', NOW(), NOW()),
(UUID(), 'APPLE', NOW(), NOW()),
(UUID(), 'SAMSUNG', NOW(), NOW()),
(UUID(), 'XIAOMI', NOW(), NOW()),
(UUID(), 'REDMI', NOW(), NOW()),
(UUID(), 'POCO', NOW(), NOW()),
(UUID(), 'HUAWEI', NOW(), NOW()),
(UUID(), 'HONOR', NOW(), NOW()),
(UUID(), 'MOTOROLA', NOW(), NOW()),
(UUID(), 'OPPO', NOW(), NOW()),
(UUID(), 'REALME', NOW(), NOW()),
(UUID(), 'VIVO', NOW(), NOW()),
(UUID(), 'GOOGLE', NOW(), NOW()),
(UUID(), 'ONEPLUS', NOW(), NOW()),
(UUID(), 'TECNO', NOW(), NOW()),
(UUID(), 'INFINIX', NOW(), NOW()),
(UUID(), 'NOKIA', NOW(), NOW()),
(UUID(), 'SONY', NOW(), NOW()),
(UUID(), 'LG', NOW(), NOW());
