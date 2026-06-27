import { Link, useLocation } from "react-router-dom";
import { AJUSTES_MENU } from "../../pages/inventario/shared.jsx";

export default function AjustesSidebar() {
  const { pathname } = useLocation();
  const isHub = pathname === "/admin/inventario/ajustes" || pathname === "/admin/inventario/ajustes/";

  return (
    <nav className="inv-ajustes-sidebar" aria-label="Opciones de ajustes">
      <p className="inv-ajustes-sidebar__label">Opciones</p>
      <ul className="inv-ajustes-sidebar__list">
        {AJUSTES_MENU.map((item) => {
          const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`);
          return (
            <li key={item.id}>
              <Link
                to={item.path}
                className={`inv-ajustes-sidebar__link${isActive ? " is-active" : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="inv-ajustes-sidebar__link-title">{item.label}</span>
                <span className="inv-ajustes-sidebar__link-desc">{item.description}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {isHub && (
        <p className="inv-ajustes-sidebar__hint">Elige una opción para configurar el sistema.</p>
      )}
    </nav>
  );
}
