const COLOR_HEX = {
  NEGRO: "#1c1c1e",
  BLANCO: "#f4f4f5",
  DORADO: "#d4af37",
  AZUL: "#2563eb",
  VERDE: "#16a34a",
  ROJO: "#dc2626",
  MORADO: "#9333ea",
  ROSADO: "#ec4899",
  NATURAL: "#e7dcc8",
  NARANJA: "#ea580c",
  LILA: "#a855f7",
  DESERT: "#c9a66b",
  GRIS: "#6b7280",
  PLATA: "#b8bcc4",
  MIDNIGHT: "#1e293b",
  STARLIGHT: "#f5efe6",
  GRAPHITE: "#52525b",
  "VERDE OLIVA": "#65a30d",
  "AZUL SIERRA": "#5b7c99",
  "AZUL PACÍFICO": "#0369a1",
  "AZUL PACIFICO": "#0369a1",
  PURPLE: "#7c3aed",
  TITANIO: "#9ca3af",
  "TITANIO NEGRO": "#2d2d2d",
  "TITANIO BLANCO": "#e8e8e8",
  "TITANIO DESERT": "#b8956f",
  CORAL: "#fb7185",
  AMARILLO: "#eab308",
  CREMA: "#fef3c7",
};

function normalizeColorName(name) {
  return String(name || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function getDeviceColorHex(name) {
  const key = normalizeColorName(name);
  if (!key) return null;
  if (COLOR_HEX[key]) return COLOR_HEX[key];

  const partial = Object.entries(COLOR_HEX).find(([k]) => key.includes(k) || k.includes(key));
  return partial ? partial[1] : "#64748b";
}

export function isLightDeviceColor(hex) {
  if (!hex || hex[0] !== "#" || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}
