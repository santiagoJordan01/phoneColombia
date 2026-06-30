import appleDeviceColors from "../data/apple-device-colors.json";

function normalizeColorName(name) {
  return String(name || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const COLOR_HEX = {};
for (const { name, hex } of appleDeviceColors) {
  COLOR_HEX[name] = hex;
  COLOR_HEX[normalizeColorName(name)] = hex;
}

/** Alias en inglés / variantes → nombre canónico en español. */
const COLOR_ALIASES = {
  "(PRODUCT)RED": "ROJO (PRODUCT)",
  RED: "ROJO",
  BLACK: "NEGRO",
  WHITE: "BLANCO",
  BLUE: "AZUL",
  GREEN: "VERDE",
  YELLOW: "AMARILLO",
  PINK: "ROSADO",
  PURPLE: "MORADO",
  GOLD: "DORADO",
  SILVER: "PLATA",
  GRAPHITE: "GRAFITO",
  MIDNIGHT: "MEDIANOCHE",
  STARLIGHT: "ESTELAR",
  "SPACE GRAY": "GRIS ESPACIAL",
  "SPACE BLACK": "NEGRO ESPACIAL",
  "JET BLACK": "NEGRO BRILLANTE",
  "MATTE BLACK": "NEGRO MATE",
  "ROSE GOLD": "ORO ROSA",
  SLATE: "PIZARRA",
  "SIERRA BLUE": "AZUL SIERRA",
  "PACIFIC BLUE": "AZUL PACÍFICO",
  "ALPINE GREEN": "VERDE ALPINO",
  "MIDNIGHT GREEN": "VERDE MEDIANOCHE",
  "DEEP PURPLE": "MORADO PROFUNDO",
  "DEEP BLUE": "AZUL PROFUNDO",
  "NATURAL TITANIUM": "TITANIO NATURAL",
  "BLACK TITANIUM": "TITANIO NEGRO",
  "WHITE TITANIUM": "TITANIO BLANCO",
  "BLUE TITANIUM": "TITANIO AZUL",
  "DESERT TITANIUM": "TITANIO DESIERTO",
  "GOLD TITANIUM": "TITANIO DORADO",
  "SLATE TITANIUM": "TITANIO PIZARRA",
  "DESERT ROSE": "ROSA DESIERTO",
  "COSMIC ORANGE": "NARANJA CÓSMICO",
  "LIGHT GOLD": "DORADO CLARO",
  "CLOUD WHITE": "BLANCO NUBE",
  "SKY BLUE": "AZUL CIELO",
  "MIST BLUE": "AZUL NIEBLA",
  LAVENDER: "LAVANDA",
  SAGE: "SALVIA",
  MINT: "MENTA",
  TEAL: "VERDE AZULADO",
  ULTRAMARINE: "ULTRAMARINO",
  DESERT: "DESIERTO",
  NATURAL: "NATURAL",
};

const CANONICAL_NAMES = new Set(appleDeviceColors.map((c) => c.name));

export function getCanonicalColorName(name) {
  const key = normalizeColorName(name);
  if (!key) return "";
  if (CANONICAL_NAMES.has(name)) return name;
  for (const canonical of CANONICAL_NAMES) {
    if (normalizeColorName(canonical) === key) return canonical;
  }
  if (COLOR_ALIASES[key]) return COLOR_ALIASES[key];
  return String(name || "").trim().toUpperCase();
}

export function getDeviceColorHex(name) {
  const canonical = getCanonicalColorName(name);
  const lookupKey = normalizeColorName(canonical);
  if (!lookupKey) return null;
  if (COLOR_HEX[lookupKey]) return COLOR_HEX[lookupKey];
  if (COLOR_HEX[canonical]) return COLOR_HEX[canonical];

  const partial = Object.entries(COLOR_HEX).find(([k]) => {
    const normalizedKey = normalizeColorName(k);
    return lookupKey.includes(normalizedKey) || normalizedKey.includes(lookupKey);
  });
  return partial ? partial[1] : "#64748b";
}

export function isLightDeviceColor(hex) {
  if (!hex || hex[0] !== "#" || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}

export { appleDeviceColors };
