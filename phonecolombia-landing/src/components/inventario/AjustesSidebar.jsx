import { Link, useLocation } from "react-router-dom";
import InvIcon from "./InvIcon.jsx";
import { AJUSTES_MENU } from "../../pages/inventario/shared.jsx";

export default function AjustesSidebar() {
  const { pathname } = useLocation();

  return (
    <nav className="inv-ajustes-sidebar" aria-label="Opciones de ajustes">
      <p className="inv-ajustes-sidebar__label">Secciones</p>
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
                <span className="inv-ajustes-sidebar__link-head">
                  <InvIcon name={item.icon} />
                  <span className="inv-ajustes-sidebar__link-title">{item.label}</span>
                </span>
                <span className="inv-ajustes-sidebar__link-desc">{item.description}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
