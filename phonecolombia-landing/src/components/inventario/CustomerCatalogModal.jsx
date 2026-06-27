import React, { useCallback, useEffect, useState } from "react";
import ConfirmDeleteDialog from "./ConfirmDeleteDialog.jsx";
import api from "../../lib/apiClient";
import {
  EMPTY_SERVICE_CUSTOMER_FORM,
  Field,
  serviceCustomerSubtitle,
  serviceCustomerToForm,
} from "../../pages/inventario/shared.jsx";

export default function CustomerCatalogModal({ open, onClose, onUpdated }) {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState(EMPTY_SERVICE_CUSTOMER_FORM);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getServiceCustomers();
      setCustomers(data || []);
      return data || [];
    } catch (e) {
      setError(e.message || String(e));
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setEditingId(null);
    setForm(EMPTY_SERVICE_CUSTOMER_FORM);
    fetchCustomers();
  }, [open, fetchCustomers]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key !== "Escape" || saving || deleteTarget) return;
      if (editingId) {
        setEditingId(null);
        setForm(EMPTY_SERVICE_CUSTOMER_FORM);
      } else {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, editingId, saving, deleteTarget, onClose]);

  const notifyUpdated = async (createdCustomer = null) => {
    const rows = await fetchCustomers();
    onUpdated?.(rows, createdCustomer);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        document: form.document.trim() || undefined,
        notes: form.notes.trim() || undefined,
        is_active: form.is_active,
      };

      if (editingId) {
        await api.updateServiceCustomer(editingId, payload);
        setEditingId(null);
        setForm(EMPTY_SERVICE_CUSTOMER_FORM);
        await notifyUpdated();
      } else {
        const created = await api.createServiceCustomer(payload);
        setForm(EMPTY_SERVICE_CUSTOMER_FORM);
        await notifyUpdated(created);
      }
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (customer) => {
    setEditingId(customer.id);
    setForm(serviceCustomerToForm(customer));
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY_SERVICE_CUSTOMER_FORM);
  };

  const removeCustomer = (id, name) => {
    setDeleteTarget({ id, name });
  };

  const confirmRemoveCustomer = async () => {
    if (!deleteTarget) return;
    const { id, name } = deleteTarget;
    setDeletingId(id);
    setError(null);
    try {
      await api.deleteServiceCustomer(id);
      if (editingId === id) cancelEdit();
      setDeleteTarget(null);
      await notifyUpdated();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setDeletingId(null);
    }
  };

  if (!open) return null;

  return (
    <div className="inv-modal-overlay" role="presentation" onClick={() => !saving && onClose()}>
      <div
        className="inv-modal inv-modal--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inv-customer-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="inv-customer-title" className="inv-modal__title">
          {editingId ? "Editar cliente" : "Clientes"}
        </h3>
        <p className="inv-modal__text">
          {editingId
            ? "Modifica los datos del cliente. Se usa en ventas y servicio técnico."
            : "Registra clientes para seleccionarlos al vender o crear tickets ST."}
        </p>

        <form onSubmit={handleSubmit} className="inv-modal-form inv-modal-form--grid">
          <Field label="Nombre *">
            <input
              className="inv-field__input"
              placeholder="María López"
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              required
              autoFocus
              autoComplete="name"
            />
          </Field>
          <Field label="Teléfono">
            <input
              className="inv-field__input"
              type="tel"
              placeholder="300 123 4567"
              value={form.phone}
              onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
              autoComplete="tel"
            />
          </Field>
          <Field label="Correo">
            <input
              className="inv-field__input"
              type="email"
              placeholder="cliente@email.com"
              value={form.email}
              onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
              autoComplete="email"
            />
          </Field>
          <Field label="Documento">
            <input
              className="inv-field__input"
              placeholder="CC / NIT"
              value={form.document}
              onChange={(e) => setForm((s) => ({ ...s, document: e.target.value }))}
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
          <Field label="Estado" className="inv-field--span-all">
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((s) => ({ ...s, is_active: e.target.checked }))}
              />
              Cliente activo (visible al seleccionar)
            </label>
          </Field>
          <div className="inv-modal__actions inv-field--span-all">
            {editingId && (
              <button type="button" className="inv-btn inv-btn--outline" onClick={cancelEdit} disabled={saving}>
                Cancelar edición
              </button>
            )}
            <button type="submit" className="inv-btn inv-btn--primary inv-btn--inline" disabled={saving}>
              {saving ? "Guardando…" : editingId ? "Actualizar cliente" : "Agregar cliente"}
            </button>
          </div>
        </form>

        {error && <p className="inv-dash__muted" style={{ color: "var(--pc-orange-300)" }}>{error}</p>}

        {loading ? (
          <p className="inv-dash__muted">Cargando clientes…</p>
        ) : customers.length > 0 ? (
          <div className="inv-supplier-list">
            <p className="inv-supplier-list__title">Registrados ({customers.length}) — clic para editar</p>
            <ul className="inv-supplier-list__items inv-supplier-list__items--tall">
              {customers.map((c) => (
                <li
                  key={c.id}
                  className={`inv-supplier-list__item inv-supplier-list__item--clickable ${editingId === c.id ? "is-selected" : ""}`}
                >
                  <button
                    type="button"
                    className="inv-supplier-list__pick"
                    onClick={() => startEdit(c)}
                    disabled={saving}
                  >
                    <div className="inv-supplier-list__info">
                      <span className="inv-supplier-list__name">
                        {c.name}
                        {c.is_active === false && (
                          <span className="inv-badge inv-badge--amber" style={{ marginLeft: "0.35rem" }}>Inactivo</span>
                        )}
                      </span>
                      {serviceCustomerSubtitle(c) && (
                        <span className="inv-supplier-list__meta">{serviceCustomerSubtitle(c)}</span>
                      )}
                    </div>
                  </button>
                  <button
                    type="button"
                    className="inv-supplier-list__remove"
                    onClick={() => removeCustomer(c.id, c.name)}
                    disabled={deletingId === c.id}
                    aria-label={`Eliminar ${c.name}`}
                  >
                    {deletingId === c.id ? "…" : "×"}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="inv-dash__muted">No hay clientes registrados.</p>
        )}

        <div className="inv-modal__actions inv-modal__actions--solo">
          <button type="button" className="inv-btn inv-btn--outline" onClick={() => { cancelEdit(); onClose(); }} disabled={saving}>
            Cerrar
          </button>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        title="¿Eliminar cliente?"
        itemName={deleteTarget?.name}
        description={
          deleteTarget ? (
            <>
              Se eliminará el cliente <strong>{deleteTarget.name}</strong> del catálogo.
              Las ventas o tickets ya registrados conservan su historial.
            </>
          ) : null
        }
        confirmLabel="Eliminar cliente"
        loading={Boolean(deletingId)}
        onCancel={() => !deletingId && setDeleteTarget(null)}
        onConfirm={confirmRemoveCustomer}
      />
    </div>
  );
}
