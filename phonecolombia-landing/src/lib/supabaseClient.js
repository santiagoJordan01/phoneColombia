import { createClient } from "@supabase/supabase-js";

const rawUrl = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

const looksLikePlaceholder = (v) => {
  if (!v) return true;
  const s = String(v).toLowerCase();
  return /[<>\\{}]/.test(v) || s.includes("tu-") || s.includes("your-") || s.includes("placeholder");
};

const isValidHttpUrl = (str) => {
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

let _supabase = null;
let _isConfigured = false;

if (!rawUrl || !rawKey) {
  // eslint-disable-next-line no-console
  console.warn(
    "Supabase: faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env — cliente Supabase no inicializado."
  );
} else if (looksLikePlaceholder(rawUrl) || looksLikePlaceholder(rawKey) || !isValidHttpUrl(rawUrl)) {
  // eslint-disable-next-line no-console
  console.warn("Supabase: valores de entorno parecen placeholders o URL inválida:", rawUrl);
} else {
  try {
    _supabase = createClient(rawUrl, rawKey);
    _isConfigured = true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("Supabase: error al inicializar el cliente:", err);
  }
}

export const isSupabaseConfigured = _isConfigured;

const notConfiguredProxy = new Proxy(
  {},
  {
    get() {
      throw new Error(
        "Supabase no está configurado correctamente. Rellena .env con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY válidos y reinicia el servidor."
      );
    },
  }
);

export const supabase = _isConfigured ? _supabase : notConfiguredProxy;

export default supabase;
