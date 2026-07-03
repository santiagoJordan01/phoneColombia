import { Link } from "react-router-dom";
import InvIcon from "./InvIcon.jsx";
import {
  canAccessContent,
  canAccessInventory,
  canManageSales,
  canViewReports,
  isAccountant,
  isServiceTechnician,
  isSuperAdmin,
} from "../../pages/inventario/shared.jsx";

const NAV = [
  { id: "dashboard", path: "/admin/inventario/dashboard", label: "Tablero", title: "Tablero de control", icon: "dashboard" },
  { id: "inventario", path: "/admin/inventario", label: "Inventario", title: "Inventario", icon: "inventario", requiresInventory: true },
  { id: "ventas", path: "/admin/inventario/ventas", label: "Ventas", title: "Ventas", icon: "ventas", requiresSales: true },
  { id: "informes", path: "/admin/inventario/informes", label: "Informes", title: "Informes", icon: "informes", requiresReports: true },
  { id: "servicio", path: "/admin/inventario/servicio-tecnico", label: "Servicio", title: "Servicio técnico", icon: "servicio", requiresService: true },
];

export default function InventarioTopbar({
  title = "Inventario",
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
        <h1 className="inv-topbar__title">{title}</h1>
      </div>
      <nav className="inv-topbar__nav" aria-label="Secciones del inventario">
        {NAV.map((item) => {
          if (isServiceTechnician(user) && item.id !== "servicio") return null;
          if (item.requiresInventory && user && !canAccessInventory(user)) return null;
          if (item.requiresSales && user && !canManageSales(user)) return null;
          if (item.requiresReports && user && !canViewReports(user)) return null;
          if (item.requiresService && user && isAccountant(user)) return null;
          return (
            <Link
              key={item.id}
              to={item.path}
              className={`inv-btn inv-btn--ghost inv-btn--compact${current === item.id ? " is-active" : ""}`}
              title={item.title}
            >
              <InvIcon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
        {showAjustesLink && (
          <Link
            to="/admin/inventario/ajustes"
            className={`inv-btn inv-btn--ghost inv-btn--compact${current === "ajustes" ? " is-active" : ""}`}
            title="Ajustes"
          >
            <InvIcon name="ajustes" />
            Ajustes
          </Link>
        )}
        {showContentLink && (
          <Link to="/admin" className="inv-btn inv-btn--ghost inv-btn--compact" title="Panel de contenido">
            <InvIcon name="contenido" />
            Contenido
          </Link>
        )}
      </nav>
      <div className="inv-topbar__account">
        <button
          type="button"
          className="inv-btn inv-btn--outline inv-btn--icon inv-topbar__signout"
          onClick={onSignOut}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
        >
          <InvIcon name="log-out" className="" />
        </button>
      </div>
    </header>
  );
}
