-- =============================================================================
-- Phone Colombia — Parche de esquema para MariaDB 11.8.x (Hostinger / phpMyAdmin)
-- Base de datos: u949210655_Phone
--
-- Usa sintaxis nativa de MariaDB:
--   ADD COLUMN IF NOT EXISTS
--   CREATE INDEX IF NOT EXISTS
--
-- INSTRUCCIONES:
--   1) Backup de la BD.
--   2) phpMyAdmin → u949210655_Phone → SQL → pega TODO → Continuar.
--   3) Prueba inventario e informes en el admin.
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 1) TABLAS
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `suppliers` (
  `id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `contact_name` varchar(255) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `department_code` varchar(2) DEFAULT NULL,
  `municipality_code` varchar(5) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `suppliers_name_unique` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `service_customers` (
  `id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `email` varchar(120) DEFAULT NULL,
  `document` varchar(40) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `service_categories` (
  `id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `slug` varchar(60) NOT NULL,
  `description` text DEFAULT NULL,
  `sort_order` smallint unsigned NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `service_categories_slug_unique` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `service_technicians` (
  `id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `workshop` varchar(120) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `email` varchar(120) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `service_ticket_states` (
  `id` char(36) NOT NULL,
  `name` varchar(120) NOT NULL,
  `slug` varchar(60) NOT NULL,
  `sort_order` smallint unsigned NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_default` tinyint(1) NOT NULL DEFAULT 0,
  `marks_in_service` tinyint(1) NOT NULL DEFAULT 0,
  `releases_inventory` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `service_ticket_states_slug_unique` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `service_tickets` (
  `id` char(36) NOT NULL,
  `inventory_item_id` char(36) DEFAULT NULL,
  `service_customer_id` char(36) DEFAULT NULL,
  `ticket_type` varchar(30) NOT NULL DEFAULT 'inventario',
  `device_name` varchar(255) DEFAULT NULL,
  `device_reference` varchar(64) DEFAULT NULL,
  `assigned_user_id` bigint unsigned DEFAULT NULL,
  `service_technician_id` char(36) DEFAULT NULL,
  `workshop` varchar(120) DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'ingresado',
  `issue_description` text DEFAULT NULL,
  `service_category` varchar(60) DEFAULT NULL,
  `service_category_id` char(36) DEFAULT NULL,
  `repair_notes` text DEFAULT NULL,
  `repair_cost` decimal(14,2) DEFAULT NULL,
  `customer_price` decimal(14,2) DEFAULT NULL,
  `is_warranty` tinyint(1) NOT NULL DEFAULT 0,
  `customer_name` varchar(120) DEFAULT NULL,
  `customer_phone` varchar(30) DEFAULT NULL,
  `received_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `delivered_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `service_tickets_inventory_item_id_foreign` (`inventory_item_id`),
  KEY `service_tickets_assigned_user_id_foreign` (`assigned_user_id`),
  KEY `service_tickets_created_by_foreign` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `credit_payment_methods` (
  `id` char(36) NOT NULL,
  `name` varchar(80) NOT NULL,
  `slug` varchar(80) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` smallint unsigned NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `credit_payment_methods_slug_unique` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `credit_settings` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `billing_day` tinyint unsigned NOT NULL DEFAULT 15,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `device_brands` (
  `id` char(36) NOT NULL,
  `name` varchar(80) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `device_brands_name_unique` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` char(36) NOT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `auditable_type` varchar(255) NOT NULL,
  `auditable_id` varchar(64) NOT NULL,
  `action` varchar(40) NOT NULL,
  `field` varchar(255) DEFAULT NULL,
  `old_value` text DEFAULT NULL,
  `new_value` text DEFAULT NULL,
  `meta` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`meta`)),
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `audit_logs_user_id_foreign` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inventory_movements` (
  `id` char(36) NOT NULL,
  `inventory_item_id` char(36) NOT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `type` varchar(40) NOT NULL,
  `field` varchar(255) DEFAULT NULL,
  `old_value` text DEFAULT NULL,
  `new_value` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `meta` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`meta`)),
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `inventory_movements_inventory_item_id_foreign` (`inventory_item_id`),
  KEY `inventory_movements_user_id_foreign` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2) COLUMNAS — sintaxis MariaDB: ADD COLUMN IF NOT EXISTS
-- -----------------------------------------------------------------------------

-- suppliers
ALTER TABLE `suppliers`
  ADD COLUMN IF NOT EXISTS `contact_name` varchar(255) DEFAULT NULL AFTER `name`,
  ADD COLUMN IF NOT EXISTS `phone` varchar(30) DEFAULT NULL AFTER `contact_name`,
  ADD COLUMN IF NOT EXISTS `email` varchar(255) DEFAULT NULL AFTER `phone`,
  ADD COLUMN IF NOT EXISTS `department_code` varchar(2) DEFAULT NULL AFTER `email`,
  ADD COLUMN IF NOT EXISTS `municipality_code` varchar(5) DEFAULT NULL AFTER `department_code`,
  ADD COLUMN IF NOT EXISTS `city` varchar(100) DEFAULT NULL AFTER `municipality_code`,
  ADD COLUMN IF NOT EXISTS `address` varchar(255) DEFAULT NULL AFTER `city`,
  ADD COLUMN IF NOT EXISTS `notes` text DEFAULT NULL AFTER `address`;

-- inventory_products
ALTER TABLE `inventory_products`
  ADD COLUMN IF NOT EXISTS `brand` varchar(80) DEFAULT NULL AFTER `category`,
  ADD COLUMN IF NOT EXISTS `model` varchar(120) DEFAULT NULL AFTER `brand`,
  ADD COLUMN IF NOT EXISTS `storage` varchar(50) DEFAULT NULL AFTER `model`,
  ADD COLUMN IF NOT EXISTS `color` varchar(50) DEFAULT NULL AFTER `storage`,
  ADD COLUMN IF NOT EXISTS `reference_price` varchar(50) DEFAULT NULL AFTER `color`,
  ADD COLUMN IF NOT EXISTS `notes` text DEFAULT NULL AFTER `reference_price`;

-- inventory_items
ALTER TABLE `inventory_items`
  ADD COLUMN IF NOT EXISTS `inventory_product_id` char(36) DEFAULT NULL AFTER `id`,
  ADD COLUMN IF NOT EXISTS `supplier` varchar(255) DEFAULT NULL AFTER `imei`,
  ADD COLUMN IF NOT EXISTS `barcode` varchar(64) DEFAULT NULL AFTER `imei`,
  ADD COLUMN IF NOT EXISTS `battery` tinyint unsigned DEFAULT NULL AFTER `sale_price`,
  ADD COLUMN IF NOT EXISTS `acquired_at` timestamp NULL DEFAULT NULL AFTER `notes`,
  ADD COLUMN IF NOT EXISTS `supplier_id` char(36) DEFAULT NULL AFTER `supplier`,
  ADD COLUMN IF NOT EXISTS `deleted_at` timestamp NULL DEFAULT NULL AFTER `updated_at`;

-- users
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `role` varchar(32) DEFAULT NULL AFTER `is_admin`,
  ADD COLUMN IF NOT EXISTS `supplier_id` char(36) DEFAULT NULL AFTER `role`,
  ADD COLUMN IF NOT EXISTS `service_technician_id` char(36) DEFAULT NULL AFTER `supplier_id`;

-- sales
ALTER TABLE `sales`
  ADD COLUMN IF NOT EXISTS `remission_number` varchar(30) DEFAULT NULL AFTER `id`,
  ADD COLUMN IF NOT EXISTS `service_customer_id` char(36) DEFAULT NULL AFTER `user_id`,
  ADD COLUMN IF NOT EXISTS `purchase_price_at_sale` varchar(50) DEFAULT NULL AFTER `sale_price`,
  ADD COLUMN IF NOT EXISTS `credit_payment_method_id` char(36) DEFAULT NULL AFTER `payment_method`,
  ADD COLUMN IF NOT EXISTS `credit_term_type` varchar(20) DEFAULT NULL AFTER `credit_payment_method_id`,
  ADD COLUMN IF NOT EXISTS `credit_due_at` timestamp NULL DEFAULT NULL AFTER `credit_term_type`,
  ADD COLUMN IF NOT EXISTS `reservation_status` varchar(20) DEFAULT NULL AFTER `credit_status`,
  ADD COLUMN IF NOT EXISTS `returned_at` timestamp NULL DEFAULT NULL AFTER `sold_at`,
  ADD COLUMN IF NOT EXISTS `retake_price` varchar(50) DEFAULT NULL AFTER `returned_at`,
  ADD COLUMN IF NOT EXISTS `retake_payment_method` varchar(30) DEFAULT NULL AFTER `retake_price`,
  ADD COLUMN IF NOT EXISTS `reserved_at` timestamp NULL DEFAULT NULL AFTER `sold_at`;

-- service_tickets
ALTER TABLE `service_tickets`
  ADD COLUMN IF NOT EXISTS `ticket_type` varchar(30) NOT NULL DEFAULT 'inventario' AFTER `inventory_item_id`,
  ADD COLUMN IF NOT EXISTS `service_customer_id` char(36) DEFAULT NULL AFTER `inventory_item_id`,
  ADD COLUMN IF NOT EXISTS `device_name` varchar(255) DEFAULT NULL AFTER `ticket_type`,
  ADD COLUMN IF NOT EXISTS `device_reference` varchar(64) DEFAULT NULL AFTER `device_name`,
  ADD COLUMN IF NOT EXISTS `service_technician_id` char(36) DEFAULT NULL AFTER `assigned_user_id`,
  ADD COLUMN IF NOT EXISTS `workshop` varchar(120) DEFAULT NULL AFTER `assigned_user_id`,
  ADD COLUMN IF NOT EXISTS `service_category` varchar(60) DEFAULT NULL AFTER `issue_description`,
  ADD COLUMN IF NOT EXISTS `service_category_id` char(36) DEFAULT NULL AFTER `issue_description`,
  ADD COLUMN IF NOT EXISTS `repair_cost` decimal(14,2) DEFAULT NULL AFTER `repair_notes`,
  ADD COLUMN IF NOT EXISTS `customer_price` decimal(14,2) DEFAULT NULL AFTER `repair_cost`,
  ADD COLUMN IF NOT EXISTS `is_warranty` tinyint(1) NOT NULL DEFAULT 0 AFTER `customer_price`,
  ADD COLUMN IF NOT EXISTS `customer_name` varchar(120) DEFAULT NULL AFTER `is_warranty`,
  ADD COLUMN IF NOT EXISTS `customer_phone` varchar(30) DEFAULT NULL AFTER `customer_name`;

-- Nullable donde el código lo necesita
ALTER TABLE `service_tickets`
  MODIFY COLUMN `inventory_item_id` char(36) DEFAULT NULL;

ALTER TABLE `sales`
  MODIFY COLUMN `sold_at` timestamp NULL DEFAULT NULL;

-- Índices (MariaDB)
CREATE INDEX IF NOT EXISTS `inventory_items_barcode_index` ON `inventory_items` (`barcode`);
CREATE UNIQUE INDEX IF NOT EXISTS `sales_remission_number_unique` ON `sales` (`remission_number`);

-- -----------------------------------------------------------------------------
-- 3) DATOS MÍNIMOS
-- -----------------------------------------------------------------------------

UPDATE `users`
SET `role` = 'super_admin'
WHERE `is_admin` = 1 AND (`role` IS NULL OR `role` = '');

INSERT INTO `credit_settings` (`billing_day`, `created_at`, `updated_at`)
SELECT 15, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `credit_settings` LIMIT 1);

INSERT IGNORE INTO `service_ticket_states`
(`id`, `name`, `slug`, `sort_order`, `is_active`, `is_default`, `marks_in_service`, `releases_inventory`, `created_at`, `updated_at`)
VALUES
(UUID(), 'Proceso de revisión', 'proceso_revision', 1, 1, 1, 0, 0, NOW(), NOW()),
(UUID(), 'Esperando repuestos', 'esperando_repuestos', 2, 1, 0, 1, 0, NOW(), NOW()),
(UUID(), 'Servicio técnico', 'servicio_tecnico', 3, 1, 0, 1, 0, NOW(), NOW()),
(UUID(), 'Servicio realizado', 'servicio_realizado', 4, 1, 0, 0, 1, NOW(), NOW());

INSERT IGNORE INTO `service_categories`
(`id`, `name`, `slug`, `sort_order`, `is_active`, `created_at`, `updated_at`)
VALUES
(UUID(), 'Batería', 'bateria', 0, 1, NOW(), NOW()),
(UUID(), 'Pantalla / visor', 'pantalla', 1, 1, NOW(), NOW()),
(UUID(), 'Tapa / chasis', 'tapa', 2, 1, NOW(), NOW()),
(UUID(), 'Cámara', 'camara', 3, 1, NOW(), NOW()),
(UUID(), 'Puerto de carga', 'carga', 4, 1, NOW(), NOW()),
(UUID(), 'Porcentaje / calibración', 'porcentaje', 5, 1, NOW(), NOW()),
(UUID(), 'Revisión / diagnóstico', 'revision', 6, 1, NOW(), NOW()),
(UUID(), 'Otro', 'otro', 7, 1, NOW(), NOW());

INSERT INTO `service_technicians` (`id`, `name`, `workshop`, `is_active`, `created_at`, `updated_at`)
SELECT UUID(), 'BLACK PHONE', 'BLACK PHONE', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `service_technicians` WHERE `workshop` = 'BLACK PHONE' LIMIT 1);

INSERT INTO `service_technicians` (`id`, `name`, `workshop`, `is_active`, `created_at`, `updated_at`)
SELECT UUID(), 'IMEI', 'IMEI', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `service_technicians` WHERE `workshop` = 'IMEI' LIMIT 1);

INSERT INTO `service_technicians` (`id`, `name`, `workshop`, `is_active`, `created_at`, `updated_at`)
SELECT UUID(), 'ALTA GAMA', 'ALTA GAMA', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `service_technicians` WHERE `workshop` = 'ALTA GAMA' LIMIT 1);

INSERT INTO `service_technicians` (`id`, `name`, `workshop`, `is_active`, `created_at`, `updated_at`)
SELECT UUID(), 'CASTILLO', 'CASTILLO', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `service_technicians` WHERE `workshop` = 'CASTILLO' LIMIT 1);

INSERT INTO `service_technicians` (`id`, `name`, `workshop`, `is_active`, `created_at`, `updated_at`)
SELECT UUID(), 'SMART TECH', 'SMART TECH', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `service_technicians` WHERE `workshop` = 'SMART TECH' LIMIT 1);

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
(UUID(), 'ONEPLUS', NOW(), NOW());

UPDATE `sales` s
INNER JOIN `inventory_items` i ON i.id = s.inventory_item_id
SET s.purchase_price_at_sale = i.purchase_price
WHERE s.purchase_price_at_sale IS NULL;

-- Numeración de remisiones (compatible MariaDB, sin window functions en UPDATE)
SET @pc_n := 0;
UPDATE `sales`
SET `remission_number` = CONCAT(
  'R-',
  YEAR(COALESCE(`sold_at`, `reserved_at`, `created_at`)),
  '-',
  LPAD((@pc_n := @pc_n + 1), 6, '0')
)
WHERE `remission_number` IS NULL
ORDER BY COALESCE(`sold_at`, `reserved_at`, `created_at`), `id`;

-- -----------------------------------------------------------------------------
-- 4) REGISTRAR MIGRACIONES
-- -----------------------------------------------------------------------------

INSERT IGNORE INTO `migrations` (`migration`, `batch`) VALUES
('2026_06_07_230000_add_supplier_and_battery_to_inventory_items_table', 99),
('2026_06_07_231000_create_suppliers_table', 99),
('2026_06_07_232000_add_details_to_suppliers_and_inventory_products', 99),
('2026_06_07_220001_add_inventory_product_id_to_inventory_items_table', 99),
('2026_06_24_000000_add_role_to_users_table', 99),
('2026_06_25_100000_enhance_inventory_items_table', 99),
('2026_06_25_100001_create_inventory_movements_table', 99),
('2026_06_25_100002_create_sales_table', 99),
('2026_06_25_100003_create_audit_logs_table', 99),
('2026_06_25_100004_create_service_tickets_table', 99),
('2026_06_25_100005_add_supplier_id_to_users_table', 99),
('2026_06_26_100000_add_barcode_to_inventory_items_table', 99),
('2026_06_27_100000_enhance_service_tickets_table', 99),
('2026_06_28_100000_create_service_catalogs_tables', 99),
('2026_06_28_100001_add_catalog_refs_to_service_tickets_table', 99),
('2026_06_28_100002_seed_service_catalog_defaults', 99),
('2026_06_29_110000_create_service_ticket_states_table', 99),
('2026_06_29_171500_add_dane_codes_to_suppliers_table', 99),
('2026_06_29_180000_create_credit_payment_methods_table', 99),
('2026_06_29_180100_add_credit_fields_to_sales_table', 99),
('2026_06_30_100000_add_service_technician_id_to_users_table', 99),
('2026_06_30_110000_add_service_customer_id_to_sales_table', 99),
('2026_07_01_120000_add_purchase_price_at_sale_to_sales_table', 99),
('2026_07_02_100000_add_reservation_fields_to_sales_table', 99),
('2026_07_03_100000_add_remission_number_to_sales_table', 99),
('2026_07_04_100000_add_return_fields_to_sales_table', 99),
('2026_06_08_160000_create_device_brands_table', 99),
('2026_06_08_160001_seed_device_brands', 99);

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- Movimientos manuales de caja (ingresos / egresos)
-- =============================================================================
CREATE TABLE IF NOT EXISTS cash_movements (
  id CHAR(36) NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  type VARCHAR(20) NOT NULL,
  method VARCHAR(30) NOT NULL,
  amount DECIMAL(14, 2) NOT NULL,
  concept VARCHAR(255) NULL,
  notes TEXT NULL,
  occurred_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY cash_movements_occurred_at_type_index (occurred_at, type),
  CONSTRAINT cash_movements_user_id_foreign FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO migrations (migration, batch) VALUES
('2026_07_15_220000_create_cash_movements_table', 99);

-- =============================================================================
-- FIN
-- =============================================================================
