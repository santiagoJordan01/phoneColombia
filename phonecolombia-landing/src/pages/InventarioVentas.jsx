import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import InventarioTopbar from "../components/inventario/InventarioTopbar.jsx";
import CustomerCatalogModal from "../components/inventario/CustomerCatalogModal.jsx";
import SearchSelect from "../components/SearchSelect.jsx";
import InventoryItemSelect from "../components/InventoryItemSelect.jsx";
import { useCachedQuery } from "../hooks/useCachedQuery.js";
import api, { isApiConfigured } from "../lib/apiClient";
import { invalidateInventarioCache } from "../lib/inventarioCache.js";
import { useInventarioPage } from "./inventario/useInventarioPage.js";
import {
  Field,
  CREDIT_TERM_OPTIONS,
  canAccessInventory,
  canManageCustomers,
  canManageSales,
  canViewSensitiveInventoryFields,
  creditTermLabel,
  formatPrice,
  isServiceTechnician,
  serviceCustomerSubtitle,
} from "./inventario/shared.jsx";
import "../styles.css";

const PAYMENT_METHODS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "credito", label: "Crédito" },
  { value: "mixto", label: "Mixto" },
];

const EMPTY_MIXED_PAYMENT = { method: "efectivo", amount: "" };

const PAYMENT_LABELS = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  credito: "Crédito",
  mixto: "Mixto",
};

function paymentLabel(method) {
  return PAYMENT_LABELS[method] ?? method ?? "—";
}

function parseSalePrice(value) {
  return Number(String(value ?? "").replace(/[^\d.]/g, "")) || 0;
}

export default function InventarioVentas() {
  const { user, authChecked, signOut } = useInventarioPage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [customers, setCustomers] = useState([]);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [paymentModal, setPaymentModal] = useState(null);
  const [mixedPayments, setMixedPayments] = useState([
    { ...EMPTY_MIXED_PAYMENT },
    { method: "transferencia", amount: "" },
  ]);
  const [form, setForm] = useState({
    inventory_item_id: "",
    sale_price: "",
    payment_method: "efectivo",
    customer_name: "",
    customer_phone: "",
    service_customer_id: "",
    credit_payment_method_id: "",
    credit_term_type: "",
    credit_due_at: "",
    notes: "",
  });
  const [paymentForm, setPaymentForm] = useState({ method: "efectivo", amount: "", notes: "" });
  const [barcodeScan, setBarcodeScan] = useState("");
  const [scanningBarcode, setScanningBarcode] = useState(false);
  const [scannedItem, setScannedItem] = useState(null);
  const toolbarBarcodeRef = useRef(null);

  const showSensitive = canViewSensitiveInventoryFields(user);
  const isMixto = form.payment_method === "mixto";

  const mixedTotal = useMemo(
    () => mixedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    [mixedPayments],
  );

  const customerOptions = useMemo(
    () => customers
      .filter((c) => c.is_active !== false)
      .map((c) => ({
        value: c.id,
        label: c.name,
        sublabel: serviceCustomerSubtitle(c) || undefined,
      })),
    [customers],
  );

  const fetchCustomers = useCallback(async () => {
    try {
      const data = await api.getServiceCustomers({ active_only: true });
      setCustomers(data || []);
      return data || [];
    } catch {
      return [];
    }
  }, []);

  const showToast = useCallback((text, type = "success") => {
    setToast({ text, type });
  }, []);

  const preselectItemId = searchParams.get("item");
  const preselectHandled = useRef(false);

  const salesEnabled = authChecked && Boolean(user) && canManageSales(user);

  const {
    data: salesBootstrap,
    loading,
    refreshing,
    setData: setSalesBootstrap,
    refetch: reloadSales,
  } = useCachedQuery(
    ["salesBootstrap"],
    () => api.bootstrapSales(),
    { enabled: salesEnabled },
  );

  const sales = salesBootstrap?.sales || [];
  const availableItems = salesBootstrap?.available_items || [];
  const creditMethods = salesBootstrap?.credit_config?.methods || [];
  const creditSettings = salesBootstrap?.credit_config?.settings || { billing_day: 15 };

  const addAvailableItem = useCallback((item) => {
    if (!item) return;
    setSalesBootstrap((prev) => {
      const base = prev || { sales: [], available_items: [] };
      if ((base.available_items || []).some((i) => i.id === item.id)) return base;
      return { ...base, available_items: [...(base.available_items || []), item] };
    });
  }, [setSalesBootstrap]);

  const patchSalesAfterMutation = useCallback((updater) => {
    setSalesBootstrap((prev) => {
      const base = prev || { sales: [], available_items: [] };
      return typeof updater === "function" ? updater(base) : updater;
    });
    invalidateInventarioCache("dashboard", "inventory");
  }, [setSalesBootstrap]);

  useEffect(() => {
    if (!user || modalOpen || paymentModal) return;
    requestAnimationFrame(() => toolbarBarcodeRef.current?.focus());
  }, [user, modalOpen, paymentModal]);

  useEffect(() => {
    if (salesEnabled) fetchCustomers();
  }, [salesEnabled, fetchCustomers]);

  const applyPreselectedItem = useCallback((item) => {
    if (!item || preselectHandled.current) return;
    preselectHandled.current = true;
    addAvailableItem(item);
    setScannedItem(item);
    setForm((s) => ({
      ...s,
      inventory_item_id: item.id,
      sale_price: item.sale_price || s.sale_price,
    }));
    setModalOpen(true);
    setSearchParams({}, { replace: true });
  }, [addAvailableItem, setSearchParams]);

  useEffect(() => {
    if (!preselectItemId || preselectHandled.current) return;
    const item = availableItems.find((i) => i.id === preselectItemId);
    if (item) {
      applyPreselectedItem(item);
      return undefined;
    }
    if (loading || !salesBootstrap) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const detail = await api.getInventoryItem(preselectItemId);
        if (cancelled || preselectHandled.current) return;
        if (detail && (detail.status === "disponible" || detail.status === "separado")) {
          applyPreselectedItem(detail);
        }
      } catch {
        // Equipo no encontrado o sin acceso
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [preselectItemId, availableItems, loading, salesBootstrap, applyPreselectedItem]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const onItemSelect = (id) => {
    const item = availableItems.find((i) => i.id === id) || (scannedItem?.id === id ? scannedItem : null);
    if (item && !availableItems.some((i) => i.id === item.id)) {
      addAvailableItem(item);
    }
    setForm((s) => ({
      ...s,
      inventory_item_id: id,
      sale_price: item?.sale_price || s.sale_price,
    }));
    setScannedItem(item || null);
  };

  const lookupIdentifier = useCallback(async (code) => {
    const trimmed = String(code || "").trim();
    if (!trimmed) return;

    setScanningBarcode(true);
    try {
      const items = await api.getInventory({ identifier: trimmed });
      const eligible = items?.filter((i) => i.status === "disponible" || i.status === "separado") || [];
      const item = eligible[0];
      if (!item) {
        setScannedItem(null);
        showToast("No hay equipo disponible o separado con ese código de barras o IMEI", "error");
        return;
      }
      if (eligible.length > 1) {
        showToast("Código duplicado en inventario. Contacta al administrador.", "error");
        return;
      }
      addAvailableItem(item);
      setScannedItem(item);
      setForm((s) => ({
        ...s,
        inventory_item_id: item.id,
        sale_price: item.sale_price || s.sale_price,
      }));
      setBarcodeScan("");
      setEditingSale(null);
      setModalOpen(true);
      showToast(`Equipo agregado: ${item.name}`, "success");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setScanningBarcode(false);
    }
  }, [addAvailableItem, showToast]);

  const handleBarcodeKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      lookupIdentifier(barcodeScan);
    }
  };

  const openSaleModal = () => {
    resetSaleForm();
    setModalOpen(true);
  };

  const resetSaleForm = () => {
    setForm({
      inventory_item_id: "",
      sale_price: "",
      payment_method: "efectivo",
      customer_name: "",
      customer_phone: "",
      service_customer_id: "",
      credit_payment_method_id: "",
      credit_term_type: "",
      credit_due_at: "",
      notes: "",
    });
    setMixedPayments([{ ...EMPTY_MIXED_PAYMENT }, { method: "transferencia", amount: "" }]);
    setBarcodeScan("");
    setScannedItem(null);
    setEditingSale(null);
  };

  const openEditSale = (sale) => {
    setEditingSale(sale);
    setScannedItem(sale.inventory_item || null);
    setForm({
      inventory_item_id: sale.inventory_item_id,
      sale_price: sale.sale_price || "",
      payment_method: sale.payment_method || "efectivo",
      customer_name: sale.customer_name || "",
      customer_phone: sale.customer_phone || "",
      service_customer_id: sale.service_customer_id || "",
      credit_payment_method_id: sale.credit_payment_method_id || "",
      credit_term_type: sale.credit_term_type || "",
      credit_due_at: sale.credit_due_at ? String(sale.credit_due_at).slice(0, 10) : "",
      notes: sale.notes || "",
    });
    setModalOpen(true);
  };

  const needsCreditMeta = useMemo(() => {
    const salePriceNum = parseSalePrice(form.sale_price);
    if (form.payment_method === "credito") return true;
    if (form.payment_method === "mixto" && mixedTotal < salePriceNum) return true;
    return false;
  }, [form.payment_method, form.sale_price, mixedTotal]);

  const selectedSaleItem = useMemo(() => {
    if (!form.inventory_item_id) return scannedItem;
    if (scannedItem?.id === form.inventory_item_id) return scannedItem;
    return availableItems.find((i) => i.id === form.inventory_item_id) || scannedItem;
  }, [form.inventory_item_id, scannedItem, availableItems]);

  const handleCreateSale = async (e) => {
    e.preventDefault();
    if (!editingSale && !form.inventory_item_id) {
      showToast("Selecciona un equipo", "error");
      return;
    }

    const payload = { ...form };
    if (!payload.service_customer_id) delete payload.service_customer_id;
    if (!payload.credit_payment_method_id) delete payload.credit_payment_method_id;
    if (!payload.credit_term_type) delete payload.credit_term_type;
    if (!payload.credit_due_at) delete payload.credit_due_at;

    const salePriceNum = parseSalePrice(form.sale_price);
    if (isMixto) {
      const validPayments = mixedPayments
        .filter((p) => p.amount && Number(p.amount) > 0)
        .map((p) => ({ method: p.method, amount: Number(p.amount) }));
      if (validPayments.length < 2) {
        showToast("Agrega al menos dos pagos para venta mixta", "error");
        return;
      }
      const paidTotal = validPayments.reduce((sum, p) => sum + p.amount, 0);
      if (paidTotal > salePriceNum) {
        showToast("El total pagado no puede superar el precio de venta", "error");
        return;
      }
      payload.payments = validPayments;
    }

    const requiresCredit = form.payment_method === "credito"
      || (isMixto && mixedTotal < salePriceNum);
    if (requiresCredit) {
      if (!form.credit_payment_method_id) {
        showToast("Selecciona el medio de pago de crédito (Addi, Sistecredito, etc.)", "error");
        return;
      }
      if (!form.credit_term_type) {
        showToast("Selecciona el plazo de crédito", "error");
        return;
      }
    }

    if (!editingSale && selectedSaleItem?.status === "separado") {
      const apartadoNote = selectedSaleItem.notes?.trim();
      const confirmMsg = apartadoNote
        ? `Este equipo está SEPARADO (apartado).\n\nApartado: ${apartadoNote}\n\n¿Confirmar venta?`
        : "Este equipo está SEPARADO (apartado). ¿Confirmar que corresponde registrar la venta?";
      if (!window.confirm(confirmMsg)) return;
    }

    setSubmitting(true);
    try {
      if (editingSale) {
        const { inventory_item_id, payments, ...updatePayload } = payload;
        const sale = await api.updateSale(editingSale.id, updatePayload);
        showToast("Venta actualizada");
        setModalOpen(false);
        resetSaleForm();
        patchSalesAfterMutation((prev) => ({
          ...prev,
          sales: (prev.sales || []).map((s) => (s.id === sale.id ? sale : s)),
        }));
      } else {
        const sale = await api.createSale(payload);
        showToast("Venta registrada");
        setModalOpen(false);
        resetSaleForm();
        patchSalesAfterMutation((prev) => ({
          sales: [sale, ...(prev.sales || [])],
          available_items: (prev.available_items || []).filter((i) => i.id !== payload.inventory_item_id),
        }));
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    if (!paymentModal) return;
    setSubmitting(true);
    try {
      const sale = await api.addSalePayment(paymentModal.id, {
        ...paymentForm,
        amount: Number(paymentForm.amount),
      });
      showToast("Abono registrado");
      setPaymentModal(null);
      setPaymentForm({ method: "efectivo", amount: "", notes: "" });
      patchSalesAfterMutation((prev) => ({
        ...prev,
        sales: (prev.sales || []).map((s) => (s.id === sale.id ? sale : s)),
      }));
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isApiConfigured || !authChecked || !user) {
    return (
      <div className="inv-dash inv-dash--centered">
        <div className="inv-loader" aria-label="Cargando" />
      </div>
    );
  }

  const onCustomerPick = (customerId) => {
    const customer = customers.find((c) => c.id === customerId);
    setForm((s) => ({
      ...s,
      service_customer_id: customerId,
      customer_name: customer?.name || "",
      customer_phone: customer?.phone || "",
    }));
  };

  const handleCustomersUpdated = (rows, createdCustomer = null) => {
    setCustomers(rows || []);
    if (createdCustomer?.id) {
      onCustomerPick(createdCustomer.id);
    }
  };

  if (isServiceTechnician(user)) {
    return <Navigate to="/admin/inventario/servicio-tecnico" replace />;
  }

  if (!canManageSales(user)) {
    return canAccessInventory(user) ? <Navigate to="/admin/inventario" replace /> : <Navigate to="/admin" replace />;
  }

  return (
    <div className="inv-dash">
      <InventarioTopbar current="ventas" title="Ventas" subtitle="Registro de ventas y créditos" user={user} onSignOut={signOut} />
      <main className="inv-main inv-main--sheet">
        <section className="inv-panel inv-panel--sheet">
          <div className="inv-sheet-toolbar">
            <div className="inv-sheet-toolbar__main">
              <h2 className="inv-panel__title inv-panel__title--toolbar" style={{ margin: 0 }}>Historial de ventas</h2>
              <label className="inv-sale-scan">
                <span className="inv-sale-scan__label">Código de barras / IMEI</span>
                <input
                  ref={toolbarBarcodeRef}
                  className="inv-sale-scan__input inv-field__input--mono"
                  placeholder="Escanear código de barras o IMEI…"
                  value={barcodeScan}
                  onChange={(e) => setBarcodeScan(e.target.value)}
                  onKeyDown={handleBarcodeKeyDown}
                  disabled={scanningBarcode || modalOpen}
                  autoComplete="off"
                  aria-label="Escanear código de barras o IMEI"
                />
              </label>
            </div>
            <div className="inv-sheet-actions">
              {canManageCustomers(user) && (
                <button type="button" className="inv-btn inv-btn--outline" onClick={() => setCustomerModalOpen(true)}>
                  + Cliente
                </button>
              )}
              <button type="button" className="inv-btn inv-btn--primary inv-btn--inline" onClick={openSaleModal}>
                + Nueva venta
              </button>
              <button type="button" className="inv-btn inv-btn--ghost" onClick={reloadSales} disabled={loading || refreshing}>Actualizar</button>
            </div>
          </div>
          <div className="inv-table-wrap inv-table-wrap--sheet">
            <table className="inv-table inv-table--sheet">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Equipo</th>
                  <th>Precio</th>
                  <th>Método</th>
                  <th>Pagado</th>
                  <th>Pendiente</th>
                  <th>Cliente</th>
                  <th>Vendedor</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {loading && !salesBootstrap ? (
                  <tr><td colSpan={9} className="inv-sheet-empty">Cargando…</td></tr>
                ) : sales.length === 0 ? (
                  <tr><td colSpan={9} className="inv-sheet-empty">No hay ventas registradas.</td></tr>
                ) : (
                  sales.map((sale) => (
                    <tr key={sale.id} className="inv-sheet-row">
                      <td data-label="Fecha">{sale.sold_at ? new Date(sale.sold_at).toLocaleString("es-CO") : "—"}</td>
                      <td data-label="Equipo">{sale.inventory_item?.name || "—"}</td>
                      <td data-label="Precio">{formatPrice(sale.sale_price)}</td>
                      <td data-label="Método">{paymentLabel(sale.payment_method)}</td>
                      <td data-label="Pagado">{formatPrice(sale.amount_paid)}</td>
                      <td data-label="Pendiente">{sale.amount_due > 0 ? formatPrice(sale.amount_due) : "—"}</td>
                      <td data-label="Cliente">{sale.customer_name || sale.service_customer?.name || "—"}</td>
                      <td data-label="Vendedor">{sale.user?.name || "—"}</td>
                      <td data-label="Acciones">
                        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="inv-btn inv-btn--compact inv-btn--ghost"
                            onClick={() => openEditSale(sale)}
                          >
                            Editar
                          </button>
                          {sale.credit_status === "pending" && (
                            <button
                              type="button"
                              className="inv-btn inv-btn--compact inv-btn--outline"
                              onClick={() => setPaymentModal(sale)}
                            >
                              Abonar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {modalOpen && (
        <div className="inv-modal-overlay" onClick={() => !submitting && setModalOpen(false)}>
          <div className="inv-modal inv-modal--wide" onClick={(e) => e.stopPropagation()}>
            <h3 className="inv-modal__title">{editingSale ? "Editar venta" : "Registrar venta"}</h3>
            <form onSubmit={handleCreateSale} className="inv-modal-form inv-modal-form--grid">
              {scannedItem && (
                <p className="inv-audit-entity__summary inv-field--span-all" style={{ margin: 0 }}>
                  Equipo: <strong>{scannedItem.name}</strong>
                  {scannedItem.barcode ? ` · ${scannedItem.barcode}` : ""}
                  {showSensitive && scannedItem.imei ? ` · IMEI ${scannedItem.imei}` : ""}
                  {scannedItem.sale_price ? ` · ${formatPrice(scannedItem.sale_price)}` : ""}
                </p>
              )}

              {!editingSale && selectedSaleItem?.status === "separado" && (
                <div className="inv-separado-alert inv-field--span-all" role="status">
                  <span className="inv-badge inv-badge--separado">SEPARADO</span>
                  <span>
                    Equipo apartado. Verifica que el cliente corresponde antes de registrar la venta.
                    {selectedSaleItem.notes?.trim() ? (
                      <> <strong>Notas:</strong> {selectedSaleItem.notes.trim()}</>
                    ) : null}
                  </span>
                </div>
              )}

              {!editingSale && (
              <Field label="Equipo disponible *" className="inv-field--span-all">
                <InventoryItemSelect
                  items={availableItems}
                  value={form.inventory_item_id}
                  onChange={onItemSelect}
                  showSensitive={showSensitive}
                  placeholder="Buscar equipo…"
                  allowClear={false}
                  clearLabel="Seleccionar…"
                />
              </Field>
              )}

              <Field label="Precio de venta *">
                <input
                  className="inv-field__input"
                  value={form.sale_price}
                  onChange={(e) => setForm((s) => ({ ...s, sale_price: e.target.value }))}
                  required
                />
              </Field>
              <Field label="Método de pago *">
                <select
                  className="inv-field__input"
                  value={form.payment_method}
                  onChange={(e) => setForm((s) => ({ ...s, payment_method: e.target.value }))}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </Field>

              {form.payment_method === "credito" && (
                <p className="inv-dash__muted inv-field--span-all" style={{ margin: 0 }}>
                  El monto total quedará pendiente de cobro. Debes indicar medio de crédito y plazo.
                </p>
              )}

              {needsCreditMeta && (
                <>
                  <Field label="Medio de pago crédito *">
                    <select
                      className="inv-field__input"
                      value={form.credit_payment_method_id}
                      onChange={(e) => setForm((s) => ({ ...s, credit_payment_method_id: e.target.value }))}
                      required
                    >
                      <option value="">Seleccionar…</option>
                      {creditMethods.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Plazo de crédito *">
                    <select
                      className="inv-field__input"
                      value={form.credit_term_type}
                      onChange={(e) => setForm((s) => ({ ...s, credit_term_type: e.target.value, credit_due_at: "" }))}
                      required
                    >
                      <option value="">Seleccionar…</option>
                      {CREDIT_TERM_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </Field>
                  {form.credit_term_type === "custom" && (
                    <Field label={`Vencimiento (corte día ${creditSettings.billing_day ?? 15}) o fecha manual`}>
                      <input
                        type="date"
                        className="inv-field__input"
                        value={form.credit_due_at}
                        onChange={(e) => setForm((s) => ({ ...s, credit_due_at: e.target.value }))}
                      />
                      <p className="inv-field__hint">Si lo dejas vacío, se usará la próxima fecha de corte.</p>
                    </Field>
                  )}
                </>
              )}

              {isMixto && (
                <div className="inv-field--span-all">
                  <p className="inv-field__label">Pagos mixtos (mínimo 2)</p>
                  {mixedPayments.map((p, idx) => (
                    <div key={idx} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                      <select
                        className="inv-field__input"
                        value={p.method}
                        onChange={(e) => setMixedPayments((rows) => rows.map((r, i) => (i === idx ? { ...r, method: e.target.value } : r)))}
                      >
                        {PAYMENT_METHODS.filter((m) => m.value !== "mixto").map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                      <input
                        className="inv-field__input"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Monto"
                        value={p.amount}
                        onChange={(e) => setMixedPayments((rows) => rows.map((r, i) => (i === idx ? { ...r, amount: e.target.value } : r)))}
                      />
                      {mixedPayments.length > 2 && (
                        <button
                          type="button"
                          className="inv-btn inv-btn--ghost"
                          onClick={() => setMixedPayments((rows) => rows.filter((_, i) => i !== idx))}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="inv-btn inv-btn--outline inv-btn--compact"
                    onClick={() => setMixedPayments((rows) => [...rows, { ...EMPTY_MIXED_PAYMENT }])}
                  >
                    + Agregar pago
                  </button>
                  <p className="inv-dash__muted" style={{ marginTop: "0.5rem" }}>
                    Total pagos: {formatPrice(mixedTotal)}
                    {form.sale_price ? ` · Precio venta: ${formatPrice(form.sale_price)}` : ""}
                    {form.sale_price && mixedTotal < parseSalePrice(form.sale_price) && mixedTotal > 0 && (
                      <> · Pendiente: {formatPrice(parseSalePrice(form.sale_price) - mixedTotal)}</>
                    )}
                    {form.sale_price && mixedTotal > parseSalePrice(form.sale_price) && (
                      <span style={{ color: "var(--inv-danger, #f87171)" }}> · Supera el precio de venta</span>
                    )}
                  </p>
                </div>
              )}

              <Field label="Cliente registrado" className="inv-field--span-all">
                <SearchSelect
                  value={form.service_customer_id || ""}
                  onChange={(id) => {
                    if (!id) {
                      setForm((s) => ({ ...s, service_customer_id: "", customer_name: "", customer_phone: "" }));
                      return;
                    }
                    onCustomerPick(id);
                  }}
                  options={customerOptions}
                  placeholder="Buscar cliente…"
                />
              </Field>
              <Field label="Nombre cliente (manual)">
                <input
                  className="inv-field__input"
                  value={form.customer_name}
                  onChange={(e) => setForm((s) => ({
                    ...s,
                    customer_name: e.target.value,
                    service_customer_id: "",
                  }))}
                />
              </Field>
              <Field label="Teléfono">
                <input
                  className="inv-field__input"
                  value={form.customer_phone}
                  onChange={(e) => setForm((s) => ({
                    ...s,
                    customer_phone: e.target.value,
                    service_customer_id: "",
                  }))}
                />
              </Field>
              <Field label="Notas" className="inv-field--span-all">
                <textarea
                  className="inv-field__input inv-field__textarea"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                />
              </Field>
              <div className="inv-modal__actions inv-field--span-all">
                <button type="button" className="inv-btn inv-btn--outline" onClick={() => setModalOpen(false)} disabled={submitting}>
                  Cancelar
                </button>
                <button type="submit" className="inv-btn inv-btn--primary inv-btn--inline" disabled={submitting}>
                  {submitting ? "Guardando…" : editingSale ? "Guardar cambios" : "Registrar venta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {paymentModal && (
        <div className="inv-modal-overlay" onClick={() => !submitting && setPaymentModal(null)}>
          <div className="inv-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="inv-modal__title">Registrar abono</h3>
            <p className="inv-dash__muted">Pendiente: {formatPrice(paymentModal.amount_due)}</p>
            <form onSubmit={handleAddPayment} className="inv-modal-form">
              <Field label="Método">
                <select
                  className="inv-field__input"
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm((s) => ({ ...s, method: e.target.value }))}
                >
                  {PAYMENT_METHODS.filter((m) => m.value !== "mixto").map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Monto *">
                <input
                  className="inv-field__input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm((s) => ({ ...s, amount: e.target.value }))}
                  required
                />
              </Field>
              <div className="inv-modal__actions">
                <button type="button" className="inv-btn inv-btn--outline" onClick={() => setPaymentModal(null)} disabled={submitting}>
                  Cancelar
                </button>
                <button type="submit" className="inv-btn inv-btn--primary inv-btn--inline" disabled={submitting}>
                  Guardar abono
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {customerModalOpen && (
        <CustomerCatalogModal
          open={customerModalOpen}
          onClose={() => setCustomerModalOpen(false)}
          onUpdated={handleCustomersUpdated}
        />
      )}

      {toast && <div className={`inv-toast inv-toast--${toast.type}`}>{toast.text}</div>}
    </div>
  );
}
