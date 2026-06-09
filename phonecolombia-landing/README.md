# Phone Colombia — Landing + API Laravel

Sitio web de Phone Colombia con frontend en **React + Vite** y backend en **Laravel**.

## Estructura

- `src/` — Frontend React (landing pública + panel admin)
- `backend/` — API REST Laravel (productos, promociones, testimonios, configuración)

## Requisitos

- Node.js 18+
- PHP 8.2+ y Composer
- MySQL 8+ (XAMPP o MySQL Server)

## Backend (Laravel)

**1. Crear la base de datos en MySQL:**

```sql
CREATE DATABASE phonecolombia CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

(O ejecuta `backend/database/setup_mysql.sql` en MySQL Workbench.)

**2. Configurar y arrancar la API:**

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

Edita `backend/.env` con tus credenciales MySQL. Con **XAMPP** el puerto suele ser `3307` y `root` sin contraseña:

```env
DB_PORT=3307
DB_USERNAME=root
DB_PASSWORD=
```

```bash
php artisan migrate
php artisan db:seed
php artisan storage:link
php artisan serve
```

La API quedará en `http://localhost:8000/api`.

**Usuario admin por defecto** (creado con el seeder):

- Email: `admin@phonecolombia.com`
- Contraseña: `admin123`

Cambia estas credenciales en producción.

## Frontend (React)

```bash
cp .env.example .env
npm install
npm run dev
```

El sitio quedará en `http://localhost:5173`.

Asegúrate de que `VITE_API_URL` en `.env` apunte a tu API Laravel.

## Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Inicio de sesión admin |
| GET | `/api/products` | Listar productos |
| GET | `/api/promociones` | Listar promociones |
| GET | `/api/testimonios` | Listar testimonios |
| GET | `/api/settings/{key}` | Obtener configuración (hero, garantías) |

Las rutas de escritura (crear, editar, eliminar) requieren token Bearer de Sanctum.

## Migración desde Supabase

El proyecto dejó de usar Supabase. Los archivos en `supabase/` se conservan como referencia del esquema original. Los archivos subidos ahora se almacenan en `backend/storage/app/public/`.
