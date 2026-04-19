-- Crea la tabla `admins` si no existe
CREATE TABLE IF NOT EXISTS public.admins (
  id uuid PRIMARY KEY,
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Policy sugerida (comentar/ajustar según RLS deseada)
-- ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Admins table public read" ON public.admins
--   FOR SELECT USING (true);
