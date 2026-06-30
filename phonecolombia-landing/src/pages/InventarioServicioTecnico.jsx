import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import InventarioTopbar from "../components/inventario/InventarioTopbar.jsx";
import CurrencyInput from "../components/inventario/CurrencyInput.jsx";
import SearchSelect from "../components/SearchSelect.jsx";
import InventoryItemSelect from "../components/InventoryItemSelect.jsx";
import { useCachedQuery } from "../hooks/useCachedQuery.js";
import api, { isApiConfigured } from "../lib/apiClient";
import { invalidateInventarioCache } from "../lib/inventarioCache.js";
import { useInventarioPage } from "./inventario/useInventarioPage.js";
import {
  EMPTY_SERVICE_TICKET_FORM,
  Field,
  SERVICE_TICKET_STATUS,
  SERVICE_TICKET_TYPES,
  STATUS_LABELS,
  canAccessServiceTickets,
  canEditServiceTicket,
  canManageInventory,
  canManageServiceTickets,
  canViewSensitiveInventoryFields,
  canViewServiceTicket,
  formatPrice,
  isServiceTechnician,
  parseCop,
  serviceTicketStatusLabel,
} from "./inventario/shared.jsx";
import { userSelectOptions } from "../lib/inventarioSelectOptions.js";
import "../styles.css";

function ReadOnlyField({ label, value, className = "" }) {
  return (
    <div className={`inv-field ${className}`.trim()}>
      <span className="inv-field__label">{label}</span>
      <p className="inv-readonly-value">{value ?? "—"}</p>
    </div>
  );
}
function ticketReference(t) {
  return t.device_reference || t.inventory_item?.imei || t.inventory_item?.barcode || "—";
}

function buildPayload(form) {
  const payload = {
    ...form,
    service_customer_id: form.service_customer_id || undefined,
    service_category_id: form.service_category_id || undefined,
    service_technician_id: form.service_technician_id || undefined,
    assigned_user_id: form.assigned_user_id || undefined,
    repair_notes: form.repair_notes || undefined,
    customer_name: form.customer_name || undefined,
    customer_phone: form.customer_phone || undefined,
    device_name: form.device_name || undefined,
    device_reference: form.device_reference || undefined,
    inventory_item_id: form.inventory_item_id || undefined,
    repair_cost: form.repair_cost !== "" ? parseCop(form.repair_cost) : undefined,
    customer_price: form.customer_price !== "" ? parseCop(form.customer_price) : undefined,
  };
  if (form.ticket_type === "inventario") {
    delete payload.device_name;
  }
  if (form.ticket_type === "cliente_externo") {
    delete payload.inventory_item_id;
  }
  if (form.ticket_type === "garantia") {
    payload.is_warranty = true;
  }
  return payload;
}

export default function InventarioServicioTecnico() {
  const { user, authChecked, signOut } = useInventarioPage();
  const scanRef = useRef(null);
  const [technicians, setTechnicians] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [serviceCategories, setServiceCategories] = useState([]);
  const [serviceTechnicians, setServiceTechnicians] = useState([]);
  const [meta, setMeta] = useState({ workshops: [], categories: {}, ticket_types: {}, statuses: {} });
  const [filters, setFilters] = useState({ status: "", workshop: "", q: "" });
  const [searchDraft, setSearchDraft] = useState("");
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTicket, setEditTicket] = useState(null);
  const [viewTicket, setViewTicket] = useState(null);
  const [toast, setToast] = useState(null);
  const [scanCode, setScanCode] = useState("");
  const [form, setForm] = useState({ ...EMPTY_SERVICE_TICKET_FORM });

  const showToast = useCallback((text, type = "success") => {
    setToast({ text, type });
  }, []);

  const applyWorkshopMeta = useCallback((workshopMeta) => {
    const next = workshopMeta || { workshops: [], categories: {}, ticket_types: {}, statuses: {} };
    setMeta(next);
    if (workshopMeta?.category_options) {
      setServiceCategories(workshopMeta.category_options);
    }
    if (workshopMeta?.technician_options) {
      setServiceTechnicians(workshopMeta.technician_options);
    }
  }, []);

  const buildTicketParams = useCallback((filterState) => {
    const params = {};
    if (filterState.status) params.status = filterState.status;
    if (filterState.workshop) params.workshop = filterState.workshop;
    if (filterState.q) params.q = filterState.q;
    return params;
  }, []);

  const ticketParams = useMemo(() => buildTicketParams(filters), [filters.status, filters.workshop, filters.q]);
  const stEnabled = authChecked && Boolean(user) && canAccessServiceTickets(user);
  const modalActive = modalOpen || Boolean(editTicket);

  const { data: workshopsMeta, loading: metaLoading, refetch: refetchMeta } = useCachedQuery(
    ["serviceTicketsMeta"],
    () => api.getServiceWorkshops(),
    { enabled: stEnabled },
  );

  const {
    data: tickets,
    loading: listLoading,
    refreshing: listRefreshing,
    refetch: refetchTickets,
    setData: setTicketsData,
  } = useCachedQuery(
    ["serviceTicketsList", ticketParams],
    () => api.getServiceTickets(ticketParams),
    { enabled: stEnabled },
  );

  const { data: inventoryItems, setData: setInventoryItems } = useCachedQuery(
    ["inventory", { exclude_status: "vendido" }],
    () => api.getInventory({ exclude_status: "vendido" }),
    { enabled: stEnabled && modalActive && !isServiceTechnician(user) },
  );

  const { data: techUsers } = useCachedQuery(
    ["serviceTechniciansUsers"],
    () => api.getServiceTechnicians(),
    { enabled: stEnabled && modalActive },
  );

  const { data: customerRows } = useCachedQuery(
    ["serviceCustomersActive"],
    () => api.getServiceCustomers({ active_only: true }),
    { enabled: stEnabled && modalActive },
  );

  const items = inventoryItems || [];
  const loading = (metaLoading && !workshopsMeta) || (listLoading && tickets == null);

  useEffect(() => {
    if (workshopsMeta) applyWorkshopMeta(workshopsMeta);
  }, [workshopsMeta, applyWorkshopMeta]);

  useEffect(() => {
    if (techUsers) setTechnicians(techUsers);
  }, [techUsers]);

  useEffect(() => {
    if (customerRows) setCustomers(customerRows);
  }, [customerRows]);

  const customerOptions = useMemo(
    () => customers.map((c) => ({
      value: c.id,
      label: c.name,
      sublabel: [c.phone, c.document].filter(Boolean).join(" · ") || undefined,
    })),
    [customers],
  );

  const categoryOptions = useMemo(
    () => serviceCategories.map((c) => ({
      value: c.id,
      label: c.name,
      sublabel: c.slug,
    })),
    [serviceCategories],
  );

  const technicianOptions = useMemo(
    () => serviceTechnicians.map((t) => ({
      value: t.id,
      label: t.name,
      sublabel: [t.workshop, t.phone].filter(Boolean).join(" · ") || undefined,
    })),
    [serviceTechnicians],
  );

  const storeUserOptions = useMemo(
    () => userSelectOptions(technicians),
    [technicians],
  );

  const showSensitive = canViewSensitiveInventoryFields(user);

  const onCustomerPick = (customerId) => {
    const customer = customers.find((c) => c.id === customerId);
    setForm((s) => ({
      ...s,
      service_customer_id: customerId,
      customer_name: customer?.name || "",
      customer_phone: customer?.phone || "",
    }));
  };

  const refreshAll = useCallback(async () => {
    try {
      invalidateInventarioCache("serviceTicketsMeta", "serviceTicketsList");
      await Promise.all([refetchMeta(), refetchTickets()]);
    } catch (e) {
      showToast(e.message, "error");
    }
  }, [refetchMeta, refetchTickets, showToast]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!modalOpen) return;
    requestAnimationFrame(() => scanRef.current?.focus());
  }, [modalOpen]);

  const lookupDevice = async (code) => {
    const trimmed = String(code || "").trim();
    if (!trimmed) return;
    setScanning(true);
    try {
      let found = await api.getInventory({ barcode: trimmed });
      if (!found?.length) {
        found = await api.getInventory({ q: trimmed });
      }
      if (found?.length === 1) {
        const item = found[0];
        setForm((s) => ({
          ...s,
          ticket_type: "inventario",
          inventory_item_id: item.id,
          device_name: "",
          device_reference: item.imei || item.barcode || trimmed,
        }));
        showToast(`Equipo encontrado: ${item.name}`);
      } else if (found?.length > 1) {
        showToast("Varios equipos coinciden. Selecciona manualmente.", "error");
        setForm((s) => ({ ...s, device_reference: trimmed }));
      } else {
        setForm((s) => ({
          ...s,
          ticket_type: s.ticket_type === "inventario" ? "cliente_externo" : s.ticket_type,
          inventory_item_id: "",
          device_reference: trimmed,
        }));
        showToast("No está en inventario — registro como equipo de cliente", "error");
      }
      setScanCode("");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setScanning(false);
    }
  };

  const handleScanKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      lookupDevice(scanCode);
    }
  };

  const openCreate = () => {
    setForm({ ...EMPTY_SERVICE_TICKET_FORM });
    setScanCode("");
    setModalOpen(true);
  };

  const upsertTicket = (ticket) => {
    setTicketsData((prev) => {
      const list = prev || [];
      const idx = list.findIndex((t) => t.id === ticket.id);
      if (idx === -1) return [ticket, ...list];
      const next = [...list];
      next[idx] = ticket;
      return next;
    });
    invalidateInventarioCache("dashboard", "inventory");
  };

  const syncInventoryItemStatus = (itemId, status) => {
    if (!itemId || !status) return;
    setInventoryItems((prev) => (prev || []).map((i) => (i.id === itemId ? { ...i, status } : i)));
  };

  const createTicket = async (e) => {
    e.preventDefault();
    if (form.ticket_type === "inventario" && !form.inventory_item_id) {
      showToast("Selecciona un equipo del inventario", "error");
      return;
    }
    setSubmitting(true);
    try {
      const created = await api.createServiceTicket(buildPayload(form));
      upsertTicket(created);
      if (created.inventory_item_id && created.inventory_item?.status) {
        syncInventoryItemStatus(created.inventory_item_id, created.inventory_item.status);
      }
      showToast("Ticket creado");
      setModalOpen(false);
      setForm({ ...EMPTY_SERVICE_TICKET_FORM });
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editTicket) return;
    setSubmitting(true);
    try {
      const payload = {
            assigned_user_id: editTicket.assigned_user_id || null,
            service_customer_id: editTicket.service_customer_id || null,
            service_category_id: editTicket.service_category_id || null,
            service_technician_id: editTicket.service_technician_id || null,
            issue_description: editTicket.issue_description,
            repair_notes: editTicket.repair_notes || null,
            repair_cost: editTicket.repair_cost !== "" && editTicket.repair_cost != null ? parseCop(editTicket.repair_cost) : null,
            customer_price: editTicket.customer_price !== "" && editTicket.customer_price != null ? parseCop(editTicket.customer_price) : null,
            is_warranty: editTicket.is_warranty,
            customer_name: editTicket.customer_name || null,
            customer_phone: editTicket.customer_phone || null,
            device_name: editTicket.device_name || null,
            device_reference: editTicket.device_reference || null,
            status: editTicket.status,
          };
      const updated = await api.updateServiceTicket(editTicket.id, payload);
      upsertTicket(updated);
      if (updated.inventory_item_id && updated.inventory_item?.status) {
        syncInventoryItemStatus(updated.inventory_item_id, updated.inventory_item.status);
      }
      showToast("Ticket actualizado");
      setEditTicket(null);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (ticket, status) => {
    try {
      const updated = await api.updateServiceTicket(ticket.id, { status });
      upsertTicket(updated);
      if (updated.inventory_item_id && updated.inventory_item?.status) {
        syncInventoryItemStatus(updated.inventory_item_id, updated.inventory_item.status);
      }
      showToast("Estado actualizado");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const isInventoryType = form.ticket_type === "inventario";
  const isExternalType = form.ticket_type === "cliente_externo";
  const isWarrantyType = form.ticket_type === "garantia";

  if (!isApiConfigured || !authChecked || !user) {
    return (
      <div className="inv-dash inv-dash--centered">
        <div className="inv-loader" aria-label="Cargando" />
      </div>
    );
  }

  if (!canAccessServiceTickets(user)) {
    return <Navigate to="/admin" replace />;
  }

  const readOnlyMode = isServiceTechnician(user);

  return (
    <div className="inv-dash">
      <InventarioTopbar
        current="servicio"
        title="Servicio técnico"
        subtitle={readOnlyMode ? "Consulta de tickets asignados" : "Tickets de reparación"}
        user={user}
        onSignOut={signOut}
      />
      <main className="inv-main inv-main--sheet">
        <section className="inv-panel inv-panel--sheet">
          <div className="inv-sheet-toolbar">
            <div className="inv-sheet-toolbar__main">
              <form
                className="inv-search inv-search--compact"
                onSubmit={(e) => {
                  e.preventDefault();
                  setFilters((f) => ({ ...f, q: searchDraft }));
                }}
              >
                <input
                  className="inv-search__input"
                  placeholder="Buscar IMEI, equipo, cliente…"
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                />
              </form>
              <select
                className="inv-filter-select"
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                aria-label="Filtrar por estado"
              >
                <option value="">Todos los estados</option>
                {Object.entries(meta.statuses || SERVICE_TICKET_STATUS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <select
                className="inv-filter-select"
                value={filters.workshop}
                onChange={(e) => setFilters((f) => ({ ...f, workshop: e.target.value }))}
                aria-label="Filtrar por taller"
              >
                <option value="">Todos los talleres</option>
                {(meta.workshops || []).map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>
            <div className="inv-sheet-actions">
              {canManageInventory(user) && (
                <Link to="/admin/inventario/servicio-tecnico/catalogos" className="inv-btn inv-btn--ghost inv-btn--inline">
                  Estados y técnicos
                </Link>
              )}
              {canManageServiceTickets(user) && (
                <button type="button" className="inv-btn inv-btn--primary inv-btn--inline" onClick={openCreate}>
                  + Nuevo ticket
                </button>
              )}
              <button type="button" className="inv-btn inv-btn--ghost" onClick={refreshAll} disabled={loading || listRefreshing}>Actualizar</button>
            </div>
          </div>
          <div className={`inv-table-wrap inv-table-wrap--sheet${listRefreshing ? " is-loading" : ""}`}>
            <table className="inv-table inv-table--sheet">
              <thead>
                <tr>
                  <th>Ref.</th>
                  <th>Equipo</th>
                  <th>Tipo</th>
                  <th>Servicio</th>
                  <th>Taller</th>
                  <th>Costo</th>
                  <th>Precio cliente</th>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th>Ingreso</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={11} className="inv-sheet-empty">Cargando…</td></tr>
                ) : (tickets || []).length === 0 ? (
                  <tr><td colSpan={11} className="inv-sheet-empty">No hay tickets.</td></tr>
                ) : (
                  (tickets || []).map((t) => (
                    <tr key={t.id} className="inv-sheet-row">
                      <td data-label="Ref." className="inv-cell-mono">{ticketReference(t)}</td>
                      <td data-label="Equipo">
                        {t.display_name || t.inventory_item?.name || t.device_name || "—"}
                        {t.is_warranty && <span className="inv-badge inv-badge--amber" style={{ marginLeft: "0.35rem" }}>Garantía</span>}
                      </td>
                      <td data-label="Tipo">{SERVICE_TICKET_TYPES[t.ticket_type] || t.ticket_type}</td>
                      <td data-label="Servicio">
                        {t.category?.name || (t.service_category && meta.categories?.[t.service_category]) || ""}
                        {(t.category?.name || t.service_category) ? " · " : ""}
                        {t.issue_description}
                      </td>
                      <td data-label="Taller">{t.service_technician?.workshop || t.workshop || "—"}</td>
                      <td data-label="Costo">{t.repair_cost != null ? formatPrice(t.repair_cost) : "—"}</td>
                      <td data-label="Precio cliente">{t.customer_price != null ? formatPrice(t.customer_price) : "—"}</td>
                      <td data-label="Cliente">{t.service_customer?.name || t.customer_name || "—"}</td>
                      <td data-label="Estado">
                        {canEditServiceTicket(user) ? (
                          <select
                            className="inv-filter-select inv-st-status-select"
                            value={t.status}
                            onChange={(e) => updateStatus(t, e.target.value)}
                            aria-label="Estado del ticket"
                          >
                            {Object.entries(meta.statuses || SERVICE_TICKET_STATUS).map(([v, l]) => (
                              <option key={v} value={v}>{l}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`inv-badge inv-badge--st-${t.status}`}>
                            {serviceTicketStatusLabel(t.status)}
                          </span>
                        )}
                      </td>
                      <td data-label="Ingreso">{t.received_at ? new Date(t.received_at).toLocaleDateString("es-CO") : "—"}</td>
                      <td data-label="Acciones">
                        {canEditServiceTicket(user) && (
                          <button type="button" className="inv-btn inv-btn--compact inv-btn--ghost" onClick={() => setEditTicket({
                            ...t,
                            assigned_user_id: t.assigned_user_id || "",
                            service_customer_id: t.service_customer_id || "",
                            service_category_id: t.service_category_id || t.category?.id || "",
                            service_technician_id: t.service_technician_id || t.service_technician?.id || "",
                          })}>
                            Editar
                          </button>
                        )}
                        {canViewServiceTicket(user, t) && !canEditServiceTicket(user) && (
                          <button type="button" className="inv-btn inv-btn--compact inv-btn--ghost" onClick={() => setViewTicket(t)}>
                            Ver
                          </button>
                        )}
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
            <h3 className="inv-modal__title">Nuevo ticket de servicio técnico</h3>
            <form onSubmit={createTicket} className="inv-modal-form inv-modal-form--grid">
              <Field label="Escanear IMEI / código" className="inv-field--span-all">
                <input
                  ref={scanRef}
                  className="inv-field__input inv-field__input--mono"
                  placeholder="Escanea o escribe referencia…"
                  value={scanCode}
                  onChange={(e) => setScanCode(e.target.value)}
                  onKeyDown={handleScanKeyDown}
                  disabled={scanning || submitting}
                  autoComplete="off"
                />
              </Field>

              <Field label="Tipo de ticket *">
                <select
                  className="inv-field__input"
                  value={form.ticket_type}
                  onChange={(e) => setForm((s) => ({ ...s, ticket_type: e.target.value, inventory_item_id: "", device_name: "" }))}
                >
                  {Object.entries(meta.ticket_types || SERVICE_TICKET_TYPES).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </Field>

              <Field label="Categoría de servicio">
                <SearchSelect
                  value={form.service_category_id}
                  onChange={(id) => setForm((s) => ({ ...s, service_category_id: id }))}
                  options={categoryOptions}
                  placeholder="Buscar categoría…"
                  searchPlaceholder="Batería, pantalla…"
                />
              </Field>

              <Field label="Técnico / taller">
                <SearchSelect
                  value={form.service_technician_id}
                  onChange={(id) => {
                    const tech = serviceTechnicians.find((t) => t.id === id);
                    setForm((s) => ({
                      ...s,
                      service_technician_id: id,
                      workshop: tech?.workshop || tech?.name || "",
                    }));
                  }}
                  options={technicianOptions}
                  placeholder="Seleccionar técnico…"
                  searchPlaceholder="BLACK PHONE, IMEI…"
                />
              </Field>

              {(isInventoryType || isWarrantyType) && (
                <Field label={`Equipo de inventario${isInventoryType ? " *" : ""}`} className="inv-field--span-all">
                  <InventoryItemSelect
                    value={form.inventory_item_id}
                    onChange={(id) => {
                      const item = items.find((i) => i.id === id);
                      setForm((s) => ({
                        ...s,
                        inventory_item_id: id,
                        device_reference: item?.imei || item?.barcode || s.device_reference,
                      }));
                    }}
                    items={items}
                    showSensitive={showSensitive}
                    placeholder="Buscar equipo en inventario…"
                    allowClear={!isInventoryType}
                    clearLabel="Seleccionar…"
                  />
                </Field>
              )}

              {(isExternalType || isWarrantyType) && (
                <Field label={`Descripción del equipo${isExternalType ? " *" : ""}`} className="inv-field--span-all">
                  <input
                    className="inv-field__input"
                    placeholder="Ej. 13 PRO MAX 256GB NEGRO"
                    value={form.device_name}
                    onChange={(e) => setForm((s) => ({ ...s, device_name: e.target.value }))}
                    required={isExternalType && !form.service_customer_id}
                  />
                </Field>
              )}

              <Field label="Referencia / IMEI">
                <input
                  className="inv-field__input inv-field__input--mono"
                  value={form.device_reference}
                  onChange={(e) => setForm((s) => ({ ...s, device_reference: e.target.value }))}
                />
              </Field>

              <Field label="Cliente registrado">
                <SearchSelect
                  value={form.service_customer_id}
                  onChange={onCustomerPick}
                  options={customerOptions}
                  placeholder="Buscar cliente…"
                  searchPlaceholder="Nombre, teléfono, documento…"
                />
              </Field>

              <Field label="Responsable interno (tienda)">
                <SearchSelect
                  value={form.assigned_user_id}
                  onChange={(id) => setForm((s) => ({ ...s, assigned_user_id: id }))}
                  options={storeUserOptions}
                  placeholder="Buscar responsable…"
                  clearLabel="Sin asignar"
                />
              </Field>

              <Field label="Servicio / falla *" className="inv-field--span-all">
                <textarea
                  className="inv-field__input inv-field__textarea"
                  rows={2}
                  placeholder="Ej. CAMBIO DE BATERIA"
                  value={form.issue_description}
                  onChange={(e) => setForm((s) => ({ ...s, issue_description: e.target.value }))}
                  required
                />
              </Field>

              <Field label="Costo reparación (taller)">
                <CurrencyInput
                  value={form.repair_cost}
                  onChange={(repair_cost) => setForm((s) => ({ ...s, repair_cost }))}
                />
              </Field>

              <Field label="Precio al cliente">
                <CurrencyInput
                  value={form.customer_price}
                  onChange={(customer_price) => setForm((s) => ({ ...s, customer_price }))}
                  disabled={form.is_warranty || isWarrantyType}
                />
              </Field>

              <Field label="Nombre cliente (manual)">
                <input
                  className="inv-field__input"
                  value={form.customer_name}
                  onChange={(e) => setForm((s) => ({ ...s, customer_name: e.target.value, service_customer_id: "" }))}
                  disabled={Boolean(form.service_customer_id)}
                />
              </Field>

              <Field label="Teléfono cliente">
                <input
                  className="inv-field__input"
                  value={form.customer_phone}
                  onChange={(e) => setForm((s) => ({ ...s, customer_phone: e.target.value, service_customer_id: "" }))}
                />
              </Field>
              <p className="inv-dash__muted inv-field--span-all" style={{ margin: 0 }}>
                Si no está en catálogo, escribe nombre/teléfono manualmente o créalo en{" "}
                <Link to="/admin/inventario/servicio-tecnico/catalogos">Estados y técnicos</Link>.
              </p>

              {(isExternalType || isWarrantyType) && (
                <Field label="Garantía">
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <input
                      type="checkbox"
                      checked={form.is_warranty || isWarrantyType}
                      disabled={isWarrantyType}
                      onChange={(e) => setForm((s) => ({ ...s, is_warranty: e.target.checked, customer_price: e.target.checked ? "" : s.customer_price }))}
                    />
                    Reparación en garantía (sin cobro)
                  </label>
                </Field>
              )}

              <Field label="Notas" className="inv-field--span-all">
                <textarea
                  className="inv-field__input inv-field__textarea"
                  rows={2}
                  value={form.repair_notes}
                  onChange={(e) => setForm((s) => ({ ...s, repair_notes: e.target.value }))}
                />
              </Field>

              <div className="inv-modal__actions inv-field--span-all">
                <button type="button" className="inv-btn inv-btn--outline" onClick={() => setModalOpen(false)} disabled={submitting}>
                  Cancelar
                </button>
                <button type="submit" className="inv-btn inv-btn--primary inv-btn--inline" disabled={submitting}>
                  Crear ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editTicket && (
        <div className="inv-modal-overlay" onClick={() => !submitting && setEditTicket(null)}>
          <div className="inv-modal inv-modal--wide" onClick={(e) => e.stopPropagation()}>
            <h3 className="inv-modal__title">Editar ticket — {editTicket.display_name}</h3>
            <form onSubmit={saveEdit} className="inv-modal-form inv-modal-form--grid">
              <Field label="Estado">
                <select
                  className="inv-field__input"
                  value={editTicket.status || ""}
                  onChange={(e) => setEditTicket((t) => ({ ...t, status: e.target.value }))}
                >
                  {Object.entries(meta.statuses || SERVICE_TICKET_STATUS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </Field>
              <Field label="Categoría de servicio">
                <SearchSelect
                  value={editTicket.service_category_id || ""}
                  onChange={(id) => setEditTicket((t) => ({ ...t, service_category_id: id }))}
                  options={categoryOptions}
                  placeholder="Buscar categoría…"
                />
              </Field>
              <Field label="Técnico / taller">
                <SearchSelect
                  value={editTicket.service_technician_id || ""}
                  onChange={(id) => {
                    const tech = serviceTechnicians.find((x) => x.id === id);
                    setEditTicket((t) => ({
                      ...t,
                      service_technician_id: id,
                      workshop: tech?.workshop || tech?.name || t.workshop,
                    }));
                  }}
                  options={technicianOptions}
                  placeholder="Seleccionar técnico…"
                />
              </Field>
              <Field label="Cliente registrado">
                <SearchSelect
                  value={editTicket.service_customer_id || ""}
                  onChange={(id) => {
                    const customer = customers.find((c) => c.id === id);
                    setEditTicket((t) => ({
                      ...t,
                      service_customer_id: id,
                      customer_name: customer?.name || t.customer_name,
                      customer_phone: customer?.phone || t.customer_phone,
                    }));
                  }}
                  options={customerOptions}
                  placeholder="Buscar cliente…"
                />
              </Field>
              <Field label="Responsable interno (tienda)">
                <SearchSelect
                  value={editTicket.assigned_user_id || ""}
                  onChange={(id) => setEditTicket((t) => ({ ...t, assigned_user_id: id }))}
                  options={storeUserOptions}
                  placeholder="Buscar responsable…"
                  clearLabel="Sin asignar"
                />
              </Field>
              <Field label="Referencia / IMEI">
                <input
                  className="inv-field__input inv-field__input--mono"
                  value={editTicket.device_reference || ""}
                  onChange={(e) => setEditTicket((t) => ({ ...t, device_reference: e.target.value }))}
                />
              </Field>
              <Field label="Servicio / falla" className="inv-field--span-all">
                <textarea
                  className="inv-field__input inv-field__textarea"
                  rows={2}
                  value={editTicket.issue_description || ""}
                  onChange={(e) => setEditTicket((t) => ({ ...t, issue_description: e.target.value }))}
                />
              </Field>
              <Field label="Costo reparación">
                <CurrencyInput
                  value={editTicket.repair_cost ?? ""}
                  onChange={(repair_cost) => setEditTicket((t) => ({ ...t, repair_cost }))}
                />
              </Field>
              <Field label="Precio al cliente">
                <CurrencyInput
                  value={editTicket.customer_price ?? ""}
                  onChange={(customer_price) => setEditTicket((t) => ({ ...t, customer_price }))}
                  disabled={editTicket.is_warranty}
                />
              </Field>
              <Field label="Cliente">
                <input
                  className="inv-field__input"
                  value={editTicket.customer_name || ""}
                  onChange={(e) => setEditTicket((t) => ({ ...t, customer_name: e.target.value }))}
                />
              </Field>
              <Field label="Teléfono">
                <input
                  className="inv-field__input"
                  value={editTicket.customer_phone || ""}
                  onChange={(e) => setEditTicket((t) => ({ ...t, customer_phone: e.target.value }))}
                />
              </Field>
              <Field label="Notas de reparación" className="inv-field--span-all">
                <textarea
                  className="inv-field__input inv-field__textarea"
                  rows={3}
                  value={editTicket.repair_notes || ""}
                  onChange={(e) => setEditTicket((t) => ({ ...t, repair_notes: e.target.value }))}
                />
              </Field>
              <div className="inv-modal__actions inv-field--span-all">
                <button type="button" className="inv-btn inv-btn--outline" onClick={() => setEditTicket(null)} disabled={submitting}>
                  Cancelar
                </button>
                <button type="submit" className="inv-btn inv-btn--primary inv-btn--inline" disabled={submitting}>
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewTicket && (
        <div className="inv-modal-overlay" onClick={() => setViewTicket(null)}>
          <div className="inv-modal inv-modal--wide" onClick={(e) => e.stopPropagation()}>
            <h3 className="inv-modal__title">Ticket — {viewTicket.display_name || viewTicket.device_name || "Detalle"}</h3>
            <div className="inv-modal-form inv-modal-form--grid">
              <ReadOnlyField label="Referencia" value={ticketReference(viewTicket)} />
              <ReadOnlyField label="Estado" value={serviceTicketStatusLabel(viewTicket.status)} />
              <ReadOnlyField label="Tipo" value={SERVICE_TICKET_TYPES[viewTicket.ticket_type] || viewTicket.ticket_type} />
              <ReadOnlyField label="Taller" value={viewTicket.service_technician?.workshop || viewTicket.workshop} />
              <ReadOnlyField
                label="Equipo"
                value={viewTicket.display_name || viewTicket.inventory_item?.name || viewTicket.device_name}
                className="inv-field--span-all"
              />
              <ReadOnlyField
                label="Servicio / falla"
                value={viewTicket.issue_description}
                className="inv-field--span-all"
              />
              <ReadOnlyField label="Categoría" value={viewTicket.category?.name || viewTicket.service_category} />
              <ReadOnlyField label="Cliente" value={viewTicket.service_customer?.name || viewTicket.customer_name} />
              <ReadOnlyField label="Teléfono" value={viewTicket.service_customer?.phone || viewTicket.customer_phone} />
              <ReadOnlyField
                label="Costo reparación"
                value={viewTicket.repair_cost != null ? formatPrice(viewTicket.repair_cost) : null}
              />
              <ReadOnlyField
                label="Precio al cliente"
                value={viewTicket.customer_price != null ? formatPrice(viewTicket.customer_price) : null}
              />
              <ReadOnlyField
                label="Ingreso"
                value={viewTicket.received_at ? new Date(viewTicket.received_at).toLocaleString("es-CO") : null}
              />
              <ReadOnlyField
                label="Entrega"
                value={viewTicket.delivered_at ? new Date(viewTicket.delivered_at).toLocaleString("es-CO") : null}
              />
              <ReadOnlyField
                label="Notas de reparación"
                value={viewTicket.repair_notes}
                className="inv-field--span-all"
              />
              {viewTicket.is_warranty && (
                <p className="inv-dash__muted inv-field--span-all" style={{ margin: 0 }}>
                  Reparación en garantía
                </p>
              )}
            </div>
            <div className="inv-modal__actions">
              <button type="button" className="inv-btn inv-btn--outline" onClick={() => setViewTicket(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`inv-toast inv-toast--${toast.type}`}>{toast.text}</div>}
    </div>
  );
}
