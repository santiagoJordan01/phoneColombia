const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Extrae el valor numérico en pesos (solo enteros). */
export function parseCop(value) {
  if (value == null || value === "") return 0;
  const digits = String(value).replace(/[^\d]/g, "");
  if (!digits) return 0;
  const num = Number(digits);
  return Number.isFinite(num) ? num : 0;
}

/** Formato visual para inputs: $ 2.500.000 */
export function formatCopInput(value) {
  if (value == null || value === "") return "";
  const num = typeof value === "number" ? value : parseCop(value);
  if (num === 0 && String(value).replace(/\D/g, "") === "") return "";
  return copFormatter.format(num);
}

/** Formato de lectura (tablas, cards, KPIs). */
export function formatPrice(value) {
  if (value == null || value === "") return "";
  const num = typeof value === "number" ? value : parseCop(value);
  if (num === 0 && String(value).replace(/\D/g, "") === "") return "";
  return copFormatter.format(num);
}

/** Valor plano para enviar al API (solo dígitos). */
export function copToStorage(value) {
  const n = parseCop(value);
  return n > 0 ? String(n) : "";
}
