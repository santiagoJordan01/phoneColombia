import { Link } from "react-router-dom";
import {
  canAccessContent,
  canManageSales,
  canViewReports,
  isServiceTechnician,
  isSuperAdmin,
} from "../../pages/inventario/shared.jsx";

const NAV = [
  { id: "dashboard", path: "/admin/inventario/dashboard", label: "Dashboard" },
  { id: "inventario", path: "/admin/inventario", label: "Inventario" },
  { id: "ventas", path: "/admin/inventario/ventas", label: "Ventas", requiresSales: true },
  { id: "informes", path: "/admin/inventario/informes", label: "Informes", requiresReports: true },
  { id: "servicio", path: "/admin/inventario/servicio-tecnico", label: "Servicio técnico" },
];

export default function InventarioTopbar({
  title = "Inventario",
  subtitle = "Gestión de equipos · Phone Colombia",
  current = "inventario",
  user = null,
  onSignOut,
}) {
  const showContentLink = !user || canAccessContent(user);
  const showAjustesLink = !user || isSuperAdmin(user);

  return (
    <header className="inv-topbar">
      <div className="inv-topbar__brand">
        <span className="inv-topbar__icon" aria-hidden="true">
          <img
            src={`${import.meta.env.BASE_URL}imagenes/logo-blanco-rojo.jfif`}
            alt=""
            className="inv-topbar__logo"
          />
        </span>
        <div>
          <h1 className="inv-topbar__title">{title}</h1>
          <p className="inv-topbar__subtitle">{subtitle}</p>
        </div>
      </div>
      <nav className="inv-topbar__nav">
        {NAV.map((item) => {
          if (isServiceTechnician(user) && item.id !== "servicio") return null;
          if (item.requiresSales && user && !canManageSales(user)) return null;
          if (item.requiresReports && user && !canViewReports(user)) return null;
          return (
            <Link
              key={item.id}
              to={item.path}
              className={`inv-btn inv-btn--ghost${current === item.id ? " is-active" : ""}`}
            >
              {item.label}
            </Link>
          );
        })}
        {showAjustesLink && (
          <Link
            to="/admin/inventario/ajustes"
            className={`inv-btn inv-btn--ghost${current === "ajustes" ? " is-active" : ""}`}
          >
            Ajustes
          </Link>
        )}
        {showContentLink && (
          <Link to="/admin" className="inv-btn inv-btn--ghost">Panel de contenido</Link>
        )}
        <button type="button" className="inv-btn inv-btn--outline" onClick={onSignOut}>
          Cerrar sesión
        </button>
      </nav>
    </header>
  );
}
