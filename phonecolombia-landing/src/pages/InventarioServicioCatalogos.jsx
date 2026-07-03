import React, { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import InventarioTopbar from "../components/inventario/InventarioTopbar.jsx";
import InvIcon from "../components/inventario/InvIcon.jsx";
import api, { isApiConfigured } from "../lib/apiClient";
import { Field, canAccessInventory, canManageInventory, isServiceTechnician } from "./inventario/shared.jsx";
import "../styles.css";

const TABS = [
  { id: "estados", label: "Estados", icon: "flag" },
  { id: "tecnicos", label: "Técnicos / talleres", icon: "servicio" },
  { id: "clientes", label: "Clientes", icon: "users" },
  { id: "categorias", label: "Categorías", icon: "tag" },
];

const EMPTY_CUSTOMER = { name: "", phone: "", email: "", document: "", notes: "", is_active: true };
const EMPTY_CATEGORY = { name: "", slug: "", description: "", sort_order: 0, is_active: true };
const EMPTY_TECHNICIAN = { name: "", workshop: "", phone: "", email: "", address: "", notes: "", is_active: true };
const EMPTY_STATE = {
  name: "",
  slug: "",
  sort_order: 0,
  is_active: true,
  is_default: false,
  marks_in_service: false,
  releases_inventory: false,
};

export default function InventarioServicioCatalogos() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("estados");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [states, setStates] = useState([]);
  const [modal, setModal] = useState(null);

  const showToast = useCallback((text, type = "success") => {
    setToast({ text, type });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, cat, t, st] = await Promise.all([
        api.getServiceCustomers(),
        api.getServiceCategories(),
        api.getServiceTechniciansCatalog(),
        api.getServiceTicketStates(),
      ]);
      setCustomers(c || []);
      setCategories(cat || []);
      setTechnicians(t || []);
      setStates(st || []);
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!isApiConfigured) return;
    (async () => {
      if (!api.getToken()) {
        navigate("/admin");
        return;
      }
      try {
        const me = await api.me();
        setUser(me);
        await load();
      } catch {
        api.clearToken();
        navigate("/admin");
      }
    })();
  }, [navigate, load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const openCreate = () => {
    if (tab === "estados") setModal({ type: "estados", mode: "create", data: { ...EMPTY_STATE } });
    if (tab === "clientes") setModal({ type: "clientes", mode: "create", data: { ...EMPTY_CUSTOMER } });
    if (tab === "categorias") setModal({ type: "categorias", mode: "create", data: { ...EMPTY_CATEGORY } });
    if (tab === "tecnicos") setModal({ type: "tecnicos", mode: "create", data: { ...EMPTY_TECHNICIAN } });
  };

  const openEdit = (row) => {
    setModal({ type: tab, mode: "edit", data: { ...row, is_active: row.is_active !== false } });
  };

  const save = async (e) => {
    e.preventDefault();
    if (!modal) return;
    setSubmitting(true);
    try {
      const { type, mode, data } = modal;
      if (type === "estados") {
        const payload = {
          name: data.name.trim(),
          slug: data.slug?.trim() || undefined,
          sort_order: Number(data.sort_order) || 0,
          is_active: Boolean(data.is_active),
          is_default: Boolean(data.is_default),
          marks_in_service: Boolean(data.marks_in_service),
          releases_inventory: Boolean(data.releases_inventory),
        };
        if (mode === "create") await api.createServiceTicketState(payload);
        else await api.updateServiceTicketState(data.id, payload);
      }
      if (type === "clientes") {
        const payload = {
          name: data.name.trim(),
          phone: data.phone?.trim() || undefined,
          email: data.email?.trim() || undefined,
          document: data.document?.trim() || undefined,
          notes: data.notes?.trim() || undefined,
          is_active: Boolean(data.is_active),
        };
        if (mode === "create") await api.createServiceCustomer(payload);
        else await api.updateServiceCustomer(data.id, payload);
      }
      if (type === "categorias") {
        const payload = {
          name: data.name.trim(),
          slug: data.slug?.trim() || undefined,
          description: data.description?.trim() || undefined,
          sort_order: Number(data.sort_order) || 0,
          is_active: Boolean(data.is_active),
        };
        if (mode === "create") await api.createServiceCategory(payload);
        else await api.updateServiceCategory(data.id, payload);
      }
      if (type === "tecnicos") {
        const payload = {
          name: data.name.trim(),
          workshop: data.workshop?.trim() || undefined,
          phone: data.phone?.trim() || undefined,
          email: data.email?.trim() || undefined,
          address: data.address?.trim() || undefined,
          notes: data.notes?.trim() || undefined,
          is_active: Boolean(data.is_active),
        };
        if (mode === "create") await api.createServiceTechnician(payload);
        else await api.updateServiceTechnician(data.id, payload);
      }
      showToast(mode === "create" ? "Registro creado" : "Registro actualizado");
      setModal(null);
      load();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (row) => {
    if (!canManageInventory(user)) return;
    const labels = { estados: "estado", clientes: "cliente", categorias: "categoría", tecnicos: "técnico" };
    if (!confirm(`¿Eliminar este ${labels[tab]}?`)) return;
    try {
      if (tab === "estados") await api.deleteServiceTicketState(row.id);
      if (tab === "clientes") await api.deleteServiceCustomer(row.id);
      if (tab === "categorias") await api.deleteServiceCategory(row.id);
      if (tab === "tecnicos") await api.deleteServiceTechnician(row.id);
      showToast("Eliminado");
      load();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  if (!isApiConfigured || !user) {
    return (
      <div className="inv-dash inv-dash--centered">
        <div className="inv-loader" aria-label="Cargando" />
      </div>
    );
  }

  if (isServiceTechnician(user)) {
    return <Navigate to="/admin/inventario/servicio-tecnico" replace />;
  }

  if (!canManageInventory(user)) {
    return <Navigate to="/admin/inventario/servicio-tecnico" replace />;
  }

  if (!canAccessInventory(user)) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="inv-dash">
      <InventarioTopbar
        current="servicio"
        title="Catálogos ST"
        subtitle="Estados, técnicos, clientes y categorías"
        user={user}
        onSignOut={async () => {
          await api.logout();
          navigate("/admin");
        }}
      />
      <main className="inv-main inv-main--sheet">
        <section className="inv-panel inv-panel--sheet">
          <div className="inv-sheet-toolbar">
            <div className="inv-sheet-toolbar__main">
              <Link to="/admin/inventario/servicio-tecnico" className="inv-btn inv-btn--ghost inv-btn--compact">
                <InvIcon name="arrow-left" />
                Tickets
              </Link>
              <nav className="inv-st-tabs" aria-label="Catálogos">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`inv-st-tabs__btn${tab === t.id ? " is-active" : ""}`}
                    onClick={() => setTab(t.id)}
                  >
                    <InvIcon name={t.icon} />
                    {t.label}
                  </button>
                ))}
              </nav>
            </div>
            <div className="inv-sheet-actions">
              {canManageInventory(user) && (
                <button type="button" className="inv-btn inv-btn--primary inv-btn--inline" onClick={openCreate}>
                  <InvIcon name="plus" />
                  Nuevo
                </button>
              )}
              <button type="button" className="inv-btn inv-btn--ghost" onClick={load} disabled={loading}>
                <InvIcon name="refresh" spin={loading} />
                Actualizar
              </button>
            </div>
          </div>

          <div className="inv-table-wrap inv-table-wrap--sheet">
            {tab === "estados" && (
              <table className="inv-table inv-table--sheet">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Código</th>
                    <th>Orden</th>
                    <th>Inventario</th>
                    <th>Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="inv-sheet-empty">Cargando…</td></tr>
                  ) : states.length === 0 ? (
                    <tr><td colSpan={6} className="inv-sheet-empty">No hay estados. Crea el primero con + Nuevo.</td></tr>
                  ) : (
                    states.map((row) => (
                      <tr key={row.id} className="inv-sheet-row">
                        <td data-label="Nombre">
                          {row.name}
                          {row.is_default && <span className="inv-badge inv-badge--amber" style={{ marginLeft: "0.35rem" }}>Inicial</span>}
                        </td>
                        <td data-label="Código" className="inv-cell-mono">{row.slug}</td>
                        <td data-label="Orden">{row.sort_order ?? 0}</td>
                        <td data-label="Inventario">
                          {[row.marks_in_service && "Marca en ST", row.releases_inventory && "Libera equipo"].filter(Boolean).join(" · ") || "—"}
                        </td>
                        <td data-label="Estado">{row.is_active ? "Activo" : "Inactivo"}</td>
                        <td data-label="Acciones">
                          {canManageInventory(user) && (
                            <>
                              <button type="button" className="inv-btn inv-btn--compact inv-btn--ghost" onClick={() => openEdit(row)}><InvIcon name="pencil" /> Editar</button>
                              <button type="button" className="inv-btn inv-btn--compact inv-btn--outline" onClick={() => remove(row)} disabled={row.is_default}><InvIcon name="trash" /> Eliminar</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {tab === "clientes" && (
              <table className="inv-table inv-table--sheet">
                <thead>
                  <tr><th>Nombre</th><th>Teléfono</th><th>Email</th><th>Documento</th><th>Estado</th><th /></tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="inv-sheet-empty">Cargando…</td></tr>
                  ) : customers.length === 0 ? (
                    <tr><td colSpan={6} className="inv-sheet-empty">No hay clientes.</td></tr>
                  ) : (
                    customers.map((row) => (
                      <tr key={row.id} className="inv-sheet-row">
                        <td data-label="Nombre">{row.name}</td>
                        <td data-label="Teléfono">{row.phone || "—"}</td>
                        <td data-label="Email">{row.email || "—"}</td>
                        <td data-label="Documento">{row.document || "—"}</td>
                        <td data-label="Estado">{row.is_active ? "Activo" : "Inactivo"}</td>
                        <td data-label="Acciones">
                          {canManageInventory(user) && (
                            <>
                              <button type="button" className="inv-btn inv-btn--compact inv-btn--ghost" onClick={() => openEdit(row)}><InvIcon name="pencil" /> Editar</button>
                              <button type="button" className="inv-btn inv-btn--compact inv-btn--outline" onClick={() => remove(row)}><InvIcon name="trash" /> Eliminar</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {tab === "categorias" && (
              <table className="inv-table inv-table--sheet">
                <thead>
                  <tr><th>Nombre</th><th>Código</th><th>Orden</th><th>Descripción</th><th>Estado</th><th /></tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="inv-sheet-empty">Cargando…</td></tr>
                  ) : categories.length === 0 ? (
                    <tr><td colSpan={6} className="inv-sheet-empty">No hay categorías.</td></tr>
                  ) : (
                    categories.map((row) => (
                      <tr key={row.id} className="inv-sheet-row">
                        <td data-label="Nombre">{row.name}</td>
                        <td data-label="Código" className="inv-cell-mono">{row.slug}</td>
                        <td data-label="Orden">{row.sort_order ?? 0}</td>
                        <td data-label="Descripción">{row.description || "—"}</td>
                        <td data-label="Estado">{row.is_active ? "Activa" : "Inactiva"}</td>
                        <td data-label="Acciones">
                          {canManageInventory(user) && (
                            <>
                              <button type="button" className="inv-btn inv-btn--compact inv-btn--ghost" onClick={() => openEdit(row)}><InvIcon name="pencil" /> Editar</button>
                              <button type="button" className="inv-btn inv-btn--compact inv-btn--outline" onClick={() => remove(row)}><InvIcon name="trash" /> Eliminar</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {tab === "tecnicos" && (
              <table className="inv-table inv-table--sheet">
                <thead>
                  <tr><th>Nombre</th><th>Taller</th><th>Teléfono</th><th>Email</th><th>Dirección</th><th>Estado</th><th /></tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="inv-sheet-empty">Cargando…</td></tr>
                  ) : technicians.length === 0 ? (
                    <tr><td colSpan={7} className="inv-sheet-empty">No hay técnicos.</td></tr>
                  ) : (
                    technicians.map((row) => (
                      <tr key={row.id} className="inv-sheet-row">
                        <td data-label="Nombre">{row.name}</td>
                        <td data-label="Taller">{row.workshop || "—"}</td>
                        <td data-label="Teléfono">{row.phone || "—"}</td>
                        <td data-label="Email">{row.email || "—"}</td>
                        <td data-label="Dirección">{row.address || "—"}</td>
                        <td data-label="Estado">{row.is_active ? "Activo" : "Inactivo"}</td>
                        <td data-label="Acciones">
                          {canManageInventory(user) && (
                            <>
                              <button type="button" className="inv-btn inv-btn--compact inv-btn--ghost" onClick={() => openEdit(row)}><InvIcon name="pencil" /> Editar</button>
                              <button type="button" className="inv-btn inv-btn--compact inv-btn--outline" onClick={() => remove(row)}><InvIcon name="trash" /> Eliminar</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>

      {modal && (
        <div className="inv-modal-overlay" onClick={() => !submitting && setModal(null)}>
          <div className="inv-modal inv-modal--wide" onClick={(e) => e.stopPropagation()}>
            <h3 className="inv-modal__title">
              {modal.mode === "create" ? "Nuevo" : "Editar"}{" "}
              {modal.type === "estados" ? "estado" : modal.type === "clientes" ? "cliente" : modal.type === "categorias" ? "categoría" : "técnico"}
            </h3>
            <form onSubmit={save} className="inv-modal-form inv-modal-form--grid">
              {modal.type === "estados" && (
                <>
                  <Field label="Nombre *" className="inv-field--span-all">
                    <input className="inv-field__input" value={modal.data.name} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, name: e.target.value } }))} required />
                  </Field>
                  <Field label="Código (slug)">
                    <input className="inv-field__input inv-field__input--mono" placeholder="en_espera, listo…" value={modal.data.slug || ""} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, slug: e.target.value } }))} disabled={modal.mode === "edit"} />
                  </Field>
                  <Field label="Orden">
                    <input type="number" min="0" className="inv-field__input" value={modal.data.sort_order ?? 0} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, sort_order: e.target.value } }))} />
                  </Field>
                  <Field label="Comportamiento" className="inv-field--span-all">
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                      <input type="checkbox" checked={Boolean(modal.data.marks_in_service)} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, marks_in_service: e.target.checked } }))} />
                      Marca el equipo de inventario como &quot;Servicio técnico&quot;
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <input type="checkbox" checked={Boolean(modal.data.releases_inventory)} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, releases_inventory: e.target.checked } }))} />
                      Libera el equipo a &quot;Disponible&quot; (servicio terminado)
                    </label>
                  </Field>
                  <Field label="Estado inicial de tickets nuevos">
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <input type="checkbox" checked={Boolean(modal.data.is_default)} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, is_default: e.target.checked } }))} />
                      Usar como estado al crear un ticket
                    </label>
                  </Field>
                </>
              )}
              {modal.type === "clientes" && (
                <>
                  <Field label="Nombre *" className="inv-field--span-all">
                    <input className="inv-field__input" value={modal.data.name} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, name: e.target.value } }))} required />
                  </Field>
                  <Field label="Teléfono"><input className="inv-field__input" value={modal.data.phone || ""} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, phone: e.target.value } }))} /></Field>
                  <Field label="Email"><input type="email" className="inv-field__input" value={modal.data.email || ""} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, email: e.target.value } }))} /></Field>
                  <Field label="Documento"><input className="inv-field__input" value={modal.data.document || ""} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, document: e.target.value } }))} /></Field>
                  <Field label="Notas" className="inv-field--span-all"><textarea className="inv-field__input inv-field__textarea" rows={2} value={modal.data.notes || ""} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, notes: e.target.value } }))} /></Field>
                </>
              )}
              {modal.type === "categorias" && (
                <>
                  <Field label="Nombre *"><input className="inv-field__input" value={modal.data.name} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, name: e.target.value } }))} required /></Field>
                  <Field label="Código (slug)"><input className="inv-field__input inv-field__input--mono" placeholder="bateria, pantalla…" value={modal.data.slug || ""} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, slug: e.target.value } }))} /></Field>
                  <Field label="Orden"><input type="number" min="0" className="inv-field__input" value={modal.data.sort_order ?? 0} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, sort_order: e.target.value } }))} /></Field>
                  <Field label="Descripción" className="inv-field--span-all"><textarea className="inv-field__input inv-field__textarea" rows={2} value={modal.data.description || ""} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, description: e.target.value } }))} /></Field>
                </>
              )}
              {modal.type === "tecnicos" && (
                <>
                  <Field label="Nombre *"><input className="inv-field__input" value={modal.data.name} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, name: e.target.value } }))} required /></Field>
                  <Field label="Taller / proveedor"><input className="inv-field__input" placeholder="BLACK PHONE, IMEI…" value={modal.data.workshop || ""} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, workshop: e.target.value } }))} /></Field>
                  <Field label="Teléfono"><input className="inv-field__input" value={modal.data.phone || ""} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, phone: e.target.value } }))} /></Field>
                  <Field label="Email"><input type="email" className="inv-field__input" value={modal.data.email || ""} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, email: e.target.value } }))} /></Field>
                  <Field label="Dirección" className="inv-field--span-all"><input className="inv-field__input" value={modal.data.address || ""} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, address: e.target.value } }))} /></Field>
                  <Field label="Notas" className="inv-field--span-all"><textarea className="inv-field__input inv-field__textarea" rows={2} value={modal.data.notes || ""} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, notes: e.target.value } }))} /></Field>
                </>
              )}
              <Field label="Estado">
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input type="checkbox" checked={modal.data.is_active !== false} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, is_active: e.target.checked } }))} />
                  Activo
                </label>
              </Field>
              <div className="inv-modal__actions inv-field--span-all">
                <button type="button" className="inv-btn inv-btn--outline" onClick={() => setModal(null)} disabled={submitting}>Cancelar</button>
                <button type="submit" className="inv-btn inv-btn--primary inv-btn--inline" disabled={submitting}>Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <div className={`inv-toast inv-toast--${toast.type}`}>{toast.text}</div>}
    </div>
  );
}
