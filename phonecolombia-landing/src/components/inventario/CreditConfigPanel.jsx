import React, { useCallback, useEffect, useState } from "react";
import api from "../../lib/apiClient";
import { Field } from "../../pages/inventario/shared.jsx";

export default function CreditConfigPanel({ onToast }) {
  const [methods, setMethods] = useState([]);
  const [settings, setSettings] = useState({ billing_day: 15 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newMethod, setNewMethod] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getCreditConfig();
      setMethods(data.methods || []);
      setSettings(data.settings || { billing_day: 15 });
    } catch (err) {
      onToast?.(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddMethod = async (e) => {
    e.preventDefault();
    if (!newMethod.trim()) return;
    setSaving(true);
    try {
      await api.createCreditPaymentMethod({ name: newMethod.trim() });
      setNewMethod("");
      await load();
      onToast?.("Medio de crédito agregado");
    } catch (err) {
      onToast?.(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleMethod = async (method) => {
    setSaving(true);
    try {
      await api.updateCreditPaymentMethod(method.id, { is_active: !method.is_active });
      await load();
    } catch (err) {
      onToast?.(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const removeMethod = async (method) => {
    if (!window.confirm(`¿Eliminar "${method.name}"?`)) return;
    setSaving(true);
    try {
      await api.deleteCreditPaymentMethod(method.id);
      await load();
      onToast?.("Medio eliminado");
    } catch (err) {
      onToast?.(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.updateCreditSettings({ billing_day: Number(settings.billing_day) });
      setSettings(updated);
      onToast?.("Configuración de crédito actualizada");
    } catch (err) {
      onToast?.(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="inv-sheet-empty"><div className="inv-loader" aria-label="Cargando" /></div>;
  }

  return (
    <div className="inv-ajustes-panel">
      <section className="inv-panel" style={{ marginBottom: "1.25rem" }}>
        <h2 className="inv-panel__title">Medios de pago para crédito</h2>
        <p className="inv-dash__muted">
          Opciones disponibles al registrar ventas a crédito: Addi, Sistecredito, cupón, transferencia, tarjeta corporativa, etc.
        </p>
        <ul className="inv-supplier-list__items" style={{ marginTop: "1rem" }}>
          {methods.map((method) => (
            <li key={method.id} className="inv-supplier-list__item">
              <div className="inv-supplier-list__info">
                <span className="inv-supplier-list__name">{method.name}</span>
                <span className="inv-supplier-list__meta">{method.slug} · {method.is_active ? "Activo" : "Inactivo"}</span>
              </div>
              <div className="inv-sheet-actions">
                <button type="button" className="inv-btn inv-btn--outline inv-btn--compact" onClick={() => toggleMethod(method)} disabled={saving}>
                  {method.is_active ? "Desactivar" : "Activar"}
                </button>
                <button type="button" className="inv-btn inv-btn--ghost inv-btn--compact" onClick={() => removeMethod(method)} disabled={saving}>
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddMethod} className="inv-sheet-toolbar" style={{ marginTop: "1rem" }}>
          <Field label="Nuevo medio personalizado">
            <input
              className="inv-field__input"
              value={newMethod}
              onChange={(e) => setNewMethod(e.target.value)}
              placeholder="Ej. Nequi crédito"
            />
          </Field>
          <button type="submit" className="inv-btn inv-btn--primary inv-btn--inline" disabled={saving || !newMethod.trim()}>
            Agregar
          </button>
        </form>
      </section>

      <section className="inv-panel">
        <h2 className="inv-panel__title">Plazos y fecha de corte</h2>
        <p className="inv-dash__muted">
          Para el plazo &quot;Fecha de corte / personalizado&quot;, el vencimiento se calcula según el día de corte mensual.
        </p>
        <form onSubmit={saveSettings} className="inv-sheet-toolbar" style={{ marginTop: "1rem" }}>
          <Field label="Día de corte mensual (1–28)">
            <input
              type="number"
              min={1}
              max={28}
              className="inv-field__input"
              value={settings.billing_day ?? 15}
              onChange={(e) => setSettings((s) => ({ ...s, billing_day: e.target.value }))}
              required
            />
          </Field>
          <button type="submit" className="inv-btn inv-btn--primary inv-btn--inline" disabled={saving}>
            Guardar configuración
          </button>
        </form>
      </section>
    </div>
  );
}
