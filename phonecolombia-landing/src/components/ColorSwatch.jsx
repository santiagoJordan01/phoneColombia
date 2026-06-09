import { getDeviceColorHex, isLightDeviceColor } from "../lib/deviceColorMap";

export default function ColorSwatch({ name, size = 14, className = "" }) {
  if (!name) return null;

  const hex = getDeviceColorHex(name);
  const light = isLightDeviceColor(hex);

  return (
    <span
      className={`inv-color-swatch ${className}`.trim()}
      style={{
        width: size,
        height: size,
        backgroundColor: hex,
        borderColor: light ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.35)",
      }}
      title={name}
      aria-hidden="true"
    />
  );
}
