-- supabase/init.sql
-- SQL de inicialización para la tabla `products`.
-- Ejecutar desde el SQL Editor de Supabase o mediante migraciones.

-- Habilita extensión para generar UUIDs (si está disponible)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabla de productos mínima
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price text,
  description text,
  images text[],
  created_at timestamptz DEFAULT now()
);

-- Ejemplo de RLS: requiere crear la tabla `admins` y poblarla con los UID de admin.
-- Comentado por defecto; activa sólo si entiendes RLS y has creado `admins`.
--
-- ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Admins can manage products" ON public.products
--   FOR ALL USING (
--     EXISTS (SELECT 1 FROM public.admins WHERE admins.id = auth.uid())
--   );

-- Nota: para permisos de Storage, crea un bucket llamado `products` en la sección
-- Storage del dashboard de Supabase y ajusta su visibilidad según tus necesidades.
CREATE TABLE promociones (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  precio TEXT NOT NULL,
  bundle TEXT NOT NULL,
  imagen_url TEXT NOT NULL,
  alt TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


ALTER TABLE promociones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados pueden todo" ON promociones
  USING (auth.role() = 'authenticated');

-- Tabla para testimonios (videos)
CREATE TABLE IF NOT EXISTS public.testimonios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_url text NOT NULL,
  caption text,
  created_at timestamptz DEFAULT now()
);

-- Nota: crea en el dashboard de Supabase un bucket llamado `testimonios` en Storage
-- y ajusta la visibilidad según sea necesario (público o privado con URLs firmadas).

-- Tabla para ajustes del sitio (clave/valor)
CREATE TABLE IF NOT EXISTS public.site_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz DEFAULT now()
);

-- Insert ejemplo: valor por defecto para el video del hero (opcional)
-- INSERT INTO public.site_settings (key, value) VALUES ('hero_video_url', '/imagenes/Hero/phonecolombiavideohero.mp4');