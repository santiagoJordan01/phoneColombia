export function openRemissionPreview(saleId) {
  if (!saleId) return;
  const url = `/admin/inventario/remision/vista-previa?sale_id=${encodeURIComponent(saleId)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
