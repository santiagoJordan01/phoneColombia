-- Medios de pago a crédito para Cuadre de caja (MariaDB / phpMyAdmin)
-- Ejecutar en u949210655_Phone

-- Renombrar Addi → Crédito Addi
UPDATE `credit_payment_methods`
SET `name` = 'Crédito Addi', `is_active` = 1, `updated_at` = NOW()
WHERE `slug` = 'addi';

-- Asegurar Sistecredito
INSERT INTO `credit_payment_methods` (`id`, `name`, `slug`, `is_active`, `sort_order`, `created_at`, `updated_at`)
SELECT UUID(), 'Sistecredito', 'sistecredito', 1, 2, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `credit_payment_methods` WHERE `slug` = 'sistecredito' LIMIT 1);

UPDATE `credit_payment_methods`
SET `name` = 'Sistecredito', `is_active` = 1, `updated_at` = NOW()
WHERE `slug` = 'sistecredito';

-- Banco de Bogotá
INSERT INTO `credit_payment_methods` (`id`, `name`, `slug`, `is_active`, `sort_order`, `created_at`, `updated_at`)
SELECT UUID(), 'Banco de Bogotá', 'banco_de_bogota', 1, 3, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `credit_payment_methods` WHERE `slug` = 'banco_de_bogota' LIMIT 1);

UPDATE `credit_payment_methods`
SET `name` = 'Banco de Bogotá', `is_active` = 1, `updated_at` = NOW()
WHERE `slug` = 'banco_de_bogota';

-- Gora
INSERT INTO `credit_payment_methods` (`id`, `name`, `slug`, `is_active`, `sort_order`, `created_at`, `updated_at`)
SELECT UUID(), 'Gora', 'gora', 1, 4, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `credit_payment_methods` WHERE `slug` = 'gora' LIMIT 1);

UPDATE `credit_payment_methods`
SET `name` = 'Gora', `is_active` = 1, `updated_at` = NOW()
WHERE `slug` = 'gora';
