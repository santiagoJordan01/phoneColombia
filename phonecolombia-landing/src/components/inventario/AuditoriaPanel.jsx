import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SearchSelect from "../SearchSelect.jsx";
import api from "../../lib/apiClient";
import { userSelectOptions } from "../../lib/inventarioSelectOptions.js";

function emptyFilters() {
  return {
    user_id: "",
    action: "",
    entity: "",
    from: "",
    to: "",
    q: "",
  };
}

function AuditField({ label, children }) {
  return (
    <label className="inv-field">
      <span className="inv-field__label">{label}</span>
      {children}
    </label>
  );
}

function buildFilterParams(filters) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== "" && value != null),
  );
}

function SummaryCards({ summary }) {
  if (!summary) return null;

  const actionEntries = Object.values(summary.by_action || {});
  const entityEntries = Object.values(summary.by_entity || {});

  return (
    <div className="inv-audit-summary">
      <div className="inv-audit-summary__card inv-audit-summary__card--total">
        <span className="inv-audit-summary__value">{summary.total ?? 0}</span>
        <span className="inv-audit-summary__label">Eventos mostrados</span>
      </div>
      {actionEntries.slice(0, 4).map((item) => (
        <div key={`action-${item.label}`} className="inv-audit-summary__card">
          <span className="inv-audit-summary__value">{item.count}</span>
          <span className="inv-audit-summary__label">{item.label}</span>
        </div>
      ))}
      {entityEntries.slice(0, 3).map((item) => (
        <div key={`entity-${item.label}`} className="inv-audit-summary__card inv-audit-summary__card--muted">
          <span className="inv-audit-summary__value">{item.count}</span>
          <span className="inv-audit-summary__label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function AuditFilters({ filters, options, users, loading, onChange, onApply, onReset }) {
  const userOptions = useMemo(() => userSelectOptions(users), [users]);

  return (
    <div className="inv-audit-filters">
      <div className="inv-sheet-toolbar inv-audit-filters__grid">
        <AuditField label="Usuario">
          <SearchSelect
            value={filters.user_id}
            onChange={(id) => onChange({ user_id: id })}
            options={userOptions}
            placeholder="Todos los usuarios"
            searchPlaceholder="Buscar usuario…"
            clearLabel="Todos"
          />
        </AuditField>
        <AuditField label="Acción">
          <select
            className="inv-field__input"
            value={filters.action}
            onChange={(e) => onChange({ action: e.target.value })}
          >
            <option value="">Todas</option>
            {(options?.actions || []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </AuditField>
        <AuditField label="Entidad">
          <select
            className="inv-field__input"
            value={filters.entity}
            onChange={(e) => onChange({ entity: e.target.value })}
          >
            <option value="">Todas</option>
            {(options?.entities || []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </AuditField>
        <AuditField label="Desde">
          <input
            type="date"
            className="inv-field__input"
            value={filters.from}
            onChange={(e) => onChange({ from: e.target.value })}
          />
        </AuditField>
        <AuditField label="Hasta">
          <input
            type="date"
            className="inv-field__input"
            value={filters.to}
            onChange={(e) => onChange({ to: e.target.value })}
          />
        </AuditField>
        <AuditField label="Buscar">
          <input
            className="inv-field__input"
            value={filters.q}
            onChange={(e) => onChange({ q: e.target.value })}
            placeholder="IMEI, nombre, campo, ID…"
          />
        </AuditField>
      </div>
      <div className="inv-audit-filters__actions">
        <button type="button" className="inv-btn inv-btn--primary" onClick={onApply} disabled={loading}>
          {loading ? "Cargando…" : "Aplicar filtros"}
        </button>
        <button type="button" className="inv-btn inv-btn--outline" onClick={onReset} disabled={loading}>
          Limpiar
        </button>
      </div>
    </div>
  );
}

function MetaDetail({ meta, metaSummary }) {
  if (!metaSummary && (!meta || Object.keys(meta).length === 0)) {
    return <span className="inv-audit-meta">—</span>;
  }

  return (
    <details className="inv-audit-meta">
      <summary>{metaSummary || "Ver detalle"}</summary>
      {meta && (
        <pre className="inv-audit-meta__json">{JSON.stringify(meta, null, 2)}</pre>
      )}
    </details>
  );
}

export default function AuditoriaPanel({ users = [], onError }) {
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [filterOptions, setFilterOptions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const onErrorRef = useRef(onError);
  const requestIdRef = useRef(0);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const appliedFiltersKey = useMemo(
    () => JSON.stringify(appliedFilters),
    [appliedFilters],
  );

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const activeFilters = JSON.parse(appliedFiltersKey);

    (async () => {
      setLoading(true);
      try {
        const response = await api.getAuditLogs(buildFilterParams(activeFilters));
        if (requestId !== requestIdRef.current) return;

        const rows = Array.isArray(response) ? response : (response?.data ?? []);
        setLogs(rows);
        setSummary(Array.isArray(response) ? null : (response?.summary ?? null));
        setFilterOptions(Array.isArray(response) ? null : (response?.filters ?? null));
      } catch (e) {
        if (requestId === requestIdRef.current) {
          onErrorRef.current?.(e.message);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    })();
  }, [appliedFiltersKey]);

  const handleFilterChange = useCallback((patch) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleApply = useCallback(() => {
    setAppliedFilters({ ...filters });
  }, [filters]);

  const handleReset = useCallback(() => {
    const cleared = emptyFilters();
    setFilters(cleared);
    setAppliedFilters({ ...cleared });
  }, []);

  const hasActiveFilters = useMemo(() => {
    const active = JSON.parse(appliedFiltersKey);
    return Object.values(active).some((value) => value !== "" && value != null);
  }, [appliedFiltersKey]);

  return (
    <section className="inv-panel inv-panel--ajustes inv-audit-panel">
      <div className="inv-audit-panel__header">
        <div>
          <h3 className="inv-users-form-title">Registro de auditoría</h3>
          <p className="inv-users-form-desc">
            Historial de creaciones, cambios, ventas, importaciones y gestión de usuarios.
            Máximo 500 eventos por consulta.
          </p>
        </div>
        {hasActiveFilters && (
          <span className="inv-audit-panel__badge">Filtros activos</span>
        )}
      </div>

      <AuditFilters
        filters={filters}
        options={filterOptions}
        users={users}
        loading={loading}
        onChange={handleFilterChange}
        onApply={handleApply}
        onReset={handleReset}
      />

      <SummaryCards summary={summary} />

      <div className={`inv-table-wrap inv-audit-table-wrap${loading ? " is-loading" : ""}`}>
        <table className="inv-table inv-table--audit">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Usuario</th>
              <th>Entidad</th>
              <th>Acción</th>
              <th>Descripción</th>
              <th>Antes</th>
              <th>Después</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={8}>Sin registros para los filtros seleccionados.</td>
              </tr>
            ) : (
              logs.map((log) => {
                const isExpanded = expandedId === log.id;
                return (
                  <React.Fragment key={log.id}>
                    <tr
                      className={isExpanded ? "is-expanded" : "is-clickable"}
                      onClick={() => setExpandedId(isExpanded ? null : log.id)}
                    >
                      <td data-label="Fecha">
                        {log.created_at
                          ? new Date(log.created_at).toLocaleString("es-CO")
                          : "—"}
                      </td>
                      <td data-label="Usuario">
                        <span className="inv-audit-user">
                          <strong>{log.user?.name || "Sistema"}</strong>
                          {log.user?.role_label && (
                            <span className="inv-audit-user__role">{log.user.role_label}</span>
                          )}
                        </span>
                      </td>
                      <td data-label="Entidad">
                        <span className="inv-audit-entity">
                          <span className="inv-audit-entity__type">{log.entity_label || "—"}</span>
                          {log.entity_summary && (
                            <span className="inv-audit-entity__summary">{log.entity_summary}</span>
                          )}
                        </span>
                      </td>
                      <td data-label="Acción">
                        <span className="inv-audit-action">{log.action_label || log.action}</span>
                      </td>
                      <td data-label="Descripción" className="inv-audit-desc">
                        {log.description || "—"}
                      </td>
                      <td data-label="Antes">{log.old_value_display || log.old_value || "—"}</td>
                      <td data-label="Después">{log.new_value_display || log.new_value || "—"}</td>
                      <td data-label="Detalle" onClick={(e) => e.stopPropagation()}>
                        <MetaDetail meta={log.meta} metaSummary={log.meta_summary} />
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="inv-audit-detail-row">
                        <td colSpan={8}>
                          <div className="inv-audit-detail">
                            <div><strong>ID evento:</strong> {log.id}</div>
                            <div><strong>ID entidad:</strong> {log.auditable_id}</div>
                            {log.field_label && <div><strong>Campo:</strong> {log.field_label}</div>}
                            {log.user?.email && <div><strong>Correo:</strong> {log.user.email}</div>}
                            {log.meta_summary && <div><strong>Resumen meta:</strong> {log.meta_summary}</div>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
