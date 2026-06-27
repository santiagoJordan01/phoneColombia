import React, { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import AjustesSidebar from "../components/inventario/AjustesSidebar.jsx";
import InventarioTopbar from "../components/inventario/InventarioTopbar.jsx";
import api, { isApiConfigured } from "../lib/apiClient";
import { useInventarioPage } from "./inventario/useInventarioPage.js";
import {
  AJUSTES_MENU,
  AJUSTES_SECTIONS,
  EMPTY_USER_FORM,
  Field,
  USER_ROLES,
  USER_ROLE_HINTS,
  isSuperAdmin,
  canAccessInventory,
  canAccessContent,
} from "./inventario/shared.jsx";
import "../styles.css";

const AuditoriaPanel = React.lazy(() => import("../components/inventario/AuditoriaPanel.jsx"));

function AjustesHub() {
  return (
    <div className="inv-ajustes-welcome">
      <h2 className="inv-ajustes-hub__title">Opciones avanzadas</h2>
      <p className="inv-ajustes-hub__text">
        Configuración del sistema reservada para administradores. Los catálogos de colores,
        proveedores y modelos se gestionan desde el inventario.
      </p>
      <ul className="inv-ajustes-welcome__links">
        {AJUSTES_MENU.map((item) => (
          <li key={item.id}>
            <Link to={item.path} className="inv-settings__card inv-settings__card--link inv-ajustes-welcome__card">
              <span className="inv-settings__card-icon inv-settings__card-icon--rose" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </span>
              <span className="inv-settings__card-body">
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </span>
              <span className="inv-settings__card-action">Abrir</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function InventarioAjustes() {
  const { user, authChecked, signOut, navigate } = useInventarioPage();
  const { section } = useParams();
  const [panelUsers, setPanelUsers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [serviceTechnicians, setServiceTechnicians] = useState([]);
  const [userForm, setUserForm] = useState(EMPTY_USER_FORM);
  const [editingUserId, setEditingUserId] = useState(null);
  const [savingUser, setSavingUser] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [toast, setToast] = useState(null);

  const sectionMeta = section ? AJUSTES_SECTIONS[section] : null;

  const showToast = useCallback((text, type = "success") => {
    setToast({ text, type });
  }, []);

  const handleAuditError = useCallback((message) => {
    showToast(message, "error");
  }, [showToast]);

  const fetchPanelUsers = useCallback(async () => {
    if (!isSuperAdmin(user)) return;
    try {
      const data = await api.getUsers();
      setPanelUsers(data || []);
    } catch (e) {
      showToast(e.message, "error");
    }
  }, [user, showToast]);

  useEffect(() => {
    if (user && isSuperAdmin(user) && (section === "usuarios" || section === "auditoria")) {
      fetchPanelUsers();
    }
    if (user && isSuperAdmin(user) && section === "usuarios") {
      api.getSuppliers().then((data) => setSuppliers(data || [])).catch(() => {});
      api.getServiceTechniciansCatalog({ active_only: true }).then((data) => setServiceTechnicians(data || [])).catch(() => {});
    }
  }, [user, section, fetchPanelUsers]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (section !== "usuarios") return;
    setUserForm(EMPTY_USER_FORM);
    setEditingUserId(null);
  }, [section]);

  const startEditUser = (panelUser) => {
    setEditingUserId(panelUser.id);
    setUserForm({
      name: panelUser.name || "",
      email: panelUser.email || "",
      password: "",
      password_confirmation: "",
      role: panelUser.role || "inventory",
      supplier_id: panelUser.supplier_id || "",
      service_technician_id: panelUser.service_technician_id || "",
    });
  };

  const cancelUserEdit = () => {
    setEditingUserId(null);
    setUserForm(EMPTY_USER_FORM);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setSavingUser(true);
    try {
      const payload = {
        name: userForm.name.trim(),
        email: userForm.email.trim(),
        role: userForm.role,
        supplier_id: userForm.role === "supplier" ? userForm.supplier_id || null : null,
        service_technician_id: userForm.role === "service_technician" ? userForm.service_technician_id || null : null,
      };

      if (editingUserId) {
        if (userForm.password) {
          payload.password = userForm.password;
          payload.password_confirmation = userForm.password_confirmation;
        }
        await api.updateUser(editingUserId, payload);
        showToast("Usuario actualizado");
      } else {
        payload.password = userForm.password;
        payload.password_confirmation = userForm.password_confirmation;
        await api.createUser(payload);
        showToast("Usuario creado");
      }

      cancelUserEdit();
      fetchPanelUsers();
    } catch (err) {
      showToast(err.message || String(err), "error");
    } finally {
      setSavingUser(false);
    }
  };

  const removeUser = async (id, name) => {
    if (!confirm(`¿Eliminar la cuenta de "${name}"?`)) return;
    setDeletingUserId(id);
    try {
      await api.deleteUser(id);
      if (editingUserId === id) cancelUserEdit();
      await fetchPanelUsers();
      showToast(`Usuario "${name}" eliminado`);
    } catch (err) {
      showToast(err.message || String(err), "error");
    } finally {
      setDeletingUserId(null);
    }
  };

  if (!isApiConfigured) {
    return (
      <div className="inv-dash inv-dash--centered">
        <p className="inv-dash__muted">Inventario — API no configurada</p>
      </div>
    );
  }

  if (!authChecked || !user) {
    return (
      <div className="inv-dash inv-dash--centered">
        <div className="inv-loader" aria-label="Cargando" />
        <p className="inv-dash__muted">Verificando sesión…</p>
      </div>
    );
  }

  if (!canAccessInventory(user)) {
    if (canAccessContent(user)) {
      return <Navigate to="/admin" replace />;
    }
    return (
      <div className="inv-dash inv-dash--centered">
        <p className="inv-dash__muted">Tu cuenta no tiene acceso al inventario.</p>
        <button type="button" className="inv-btn inv-btn--outline" onClick={signOut}>Cerrar sesión</button>
      </div>
    );
  }

  if (!isSuperAdmin(user)) {
    return <Navigate to="/admin/inventario" replace />;
  }

  if (section && !sectionMeta) {
    return <Navigate to="/admin/inventario/ajustes" replace />;
  }

  const topbarTitle = sectionMeta ? sectionMeta.title : "Ajustes";
  const topbarSubtitle = sectionMeta
    ? sectionMeta.subtitle
    : "Opciones avanzadas para administradores";

  return (
    <div className="inv-dash">
      <InventarioTopbar
        title={topbarTitle}
        subtitle={topbarSubtitle}
        current="ajustes"
        user={user}
        onSignOut={signOut}
      />

      <main className="inv-main inv-main--ajustes">
        <div className="inv-ajustes-shell">
          <AjustesSidebar />

          <div className="inv-ajustes-content">
            {!section && <AjustesHub />}

            {section === "usuarios" && (
              <section className="inv-panel inv-panel--ajustes inv-panel--usuarios">
                <div className="inv-users-layout">
                  <div className="inv-users-form-wrap">
                    <div className="inv-users-form-header">
                      <h3 className="inv-users-form-title">
                        {editingUserId ? "Editar usuario" : "Nuevo usuario"}
                      </h3>
                      <p className="inv-users-form-desc">
                        {editingUserId
                          ? "Modifica los datos o cambia la contraseña. Déjala vacía para mantener la actual."
                          : "Completa los datos y asigna el rol correspondiente."}
                      </p>
                    </div>

                    <form onSubmit={handleSaveUser} className="inv-modal-form inv-modal-form--users">
                      <Field label="Nombre" className="inv-field--full">
                        <input
                          className="inv-field__input"
                          placeholder="María López"
                          value={userForm.name}
                          onChange={(e) => setUserForm((s) => ({ ...s, name: e.target.value }))}
                          required
                          autoFocus
                          autoComplete="name"
                        />
                      </Field>
                      <Field label="Correo electrónico" className="inv-field--full">
                        <input
                          className="inv-field__input"
                          type="email"
                          placeholder="usuario@phonecolombia.com"
                          value={userForm.email}
                          onChange={(e) => setUserForm((s) => ({ ...s, email: e.target.value }))}
                          required
                          autoComplete="email"
                        />
                      </Field>
                      <Field label="Rol" className="inv-field--full">
                        <select
                          className="inv-field__input"
                          value={userForm.role}
                          onChange={(e) => setUserForm((s) => ({ ...s, role: e.target.value }))}
                          disabled={editingUserId === user?.id}
                        >
                          {Object.entries(USER_ROLES).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                        <span className="inv-field-hint">{USER_ROLE_HINTS[userForm.role]}</span>
                      </Field>
                      {userForm.role === "supplier" && (
                        <Field label="Proveedor asignado" className="inv-field--full">
                          <select
                            className="inv-field__input"
                            value={userForm.supplier_id}
                            onChange={(e) => setUserForm((s) => ({ ...s, supplier_id: e.target.value }))}
                            required
                          >
                            <option value="">Seleccionar proveedor…</option>
                            {suppliers.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </Field>
                      )}
                      {userForm.role === "service_technician" && (
                        <Field label="Perfil de técnico ST" className="inv-field--full">
                          <select
                            className="inv-field__input"
                            value={userForm.service_technician_id}
                            onChange={(e) => setUserForm((s) => ({ ...s, service_technician_id: e.target.value }))}
                            required
                          >
                            <option value="">Seleccionar técnico…</option>
                            {serviceTechnicians.map((t) => (
                              <option key={t.id} value={t.id}>
                                {[t.name, t.workshop].filter(Boolean).join(" · ")}
                              </option>
                            ))}
                          </select>
                        </Field>
                      )}
                      <Field label={editingUserId ? "Nueva contraseña" : "Contraseña"}>
                        <input
                          className="inv-field__input"
                          type="password"
                          placeholder={editingUserId ? "Opcional" : "Mín. 8 caracteres"}
                          value={userForm.password}
                          onChange={(e) => setUserForm((s) => ({ ...s, password: e.target.value }))}
                          required={!editingUserId}
                          minLength={8}
                          autoComplete="new-password"
                        />
                      </Field>
                      <Field label="Confirmar">
                        <input
                          className="inv-field__input"
                          type="password"
                          placeholder={editingUserId ? "Si cambias la clave" : "Repite la contraseña"}
                          value={userForm.password_confirmation}
                          onChange={(e) => setUserForm((s) => ({ ...s, password_confirmation: e.target.value }))}
                          required={!editingUserId || Boolean(userForm.password)}
                          minLength={8}
                          autoComplete="new-password"
                        />
                      </Field>
                      <div className="inv-modal__actions inv-field--full inv-users-form-actions">
                        {editingUserId && (
                          <button type="button" className="inv-btn inv-btn--outline" onClick={cancelUserEdit} disabled={savingUser}>
                            Cancelar
                          </button>
                        )}
                        <button type="submit" className="inv-btn inv-btn--primary inv-btn--inline" disabled={savingUser}>
                          {savingUser ? "Guardando…" : editingUserId ? "Guardar cambios" : "Crear usuario"}
                        </button>
                      </div>
                    </form>
                  </div>

                  {panelUsers.length > 0 && (
                    <div className="inv-users-list">
                      <div className="inv-users-list__header">
                        <p className="inv-supplier-list__title">Cuentas del panel</p>
                        <span className="inv-users-list__count">{panelUsers.length}</span>
                      </div>
                      <ul className="inv-users-list__items">
                        {panelUsers.map((panelUser) => (
                          <li
                            key={panelUser.id}
                            className={`inv-users-list__item ${editingUserId === panelUser.id ? "is-selected" : ""}`}
                          >
                            <button
                              type="button"
                              className="inv-users-list__pick"
                              onClick={() => startEditUser(panelUser)}
                              disabled={savingUser}
                            >
                              <span className="inv-users-list__avatar" aria-hidden="true">
                                {(panelUser.name || "?").charAt(0).toUpperCase()}
                              </span>
                              <span className="inv-users-list__body">
                                <span className="inv-users-list__name">
                                  {panelUser.name}
                                  {panelUser.id === user?.id && (
                                    <span className="inv-user-badge">Tú</span>
                                  )}
                                </span>
                                <span className="inv-users-list__email">{panelUser.email}</span>
                                <span className="inv-users-list__role-mobile">
                                  {USER_ROLES[panelUser.role] || panelUser.role}
                                </span>
                              </span>
                              <span className={`inv-user-role inv-user-role--${panelUser.role}`}>
                                {USER_ROLES[panelUser.role] || panelUser.role}
                              </span>
                            </button>
                            {panelUser.id !== user?.id && (
                              <button
                                type="button"
                                className="inv-supplier-list__remove"
                                onClick={() => removeUser(panelUser.id, panelUser.name)}
                                disabled={deletingUserId === panelUser.id}
                                aria-label={`Eliminar ${panelUser.name}`}
                              >
                                {deletingUserId === panelUser.id ? "…" : "×"}
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>
            )}

            {section === "auditoria" && (
              <Suspense fallback={(
                <section className="inv-panel inv-panel--ajustes">
                  <div className="inv-loader" aria-label="Cargando auditoría" />
                  <p className="inv-users-form-desc">Cargando registro de auditoría…</p>
                </section>
              )}
              >
                <AuditoriaPanel users={panelUsers} onError={handleAuditError} />
              </Suspense>
            )}
          </div>
        </div>
      </main>

      {toast && (
        <div className={`inv-toast inv-toast--${toast.type}`} role={toast.type === "error" ? "alert" : "status"}>
          <span className="inv-toast__text">{toast.text}</span>
          <button type="button" className="inv-toast__close" onClick={() => setToast(null)} aria-label="Cerrar">×</button>
        </div>
      )}
    </div>
  );
}
