import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  // Efecto para navbar con scroll
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    handleScroll();

    // Bloquear scroll cuando el menú está abierto
    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
      document.body.classList.add("mobile-menu-open");
    } else {
      document.body.style.overflow = "";
      document.body.classList.remove("mobile-menu-open");
    }

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.body.style.overflow = "";
      document.body.classList.remove("mobile-menu-open");
    };
  }, [isMenuOpen]);

  return (
    <>
      {/* Overlay para cerrar menú al hacer clic fuera */}
      {isMenuOpen && (
        <div className="nav-overlay" onClick={closeMenu} aria-hidden="true" />
      )}

      <header className="header">
        <nav className={`navbar ${isScrolled ? "scrolled" : ""}`}>
          <div className="nav-container" style={{ width: '100%' }}>
            <a className="logo" href={`${import.meta.env.BASE_URL}#inicio`} onClick={closeMenu}>
              <img
                src={`${import.meta.env.BASE_URL}imagenes/logo-blanco-rojo.jfif`}
                alt="Phone Colombia Logo"
                className="imagenLogo"
              />
            </a>
            <ul className={`nav-links ${isMenuOpen ? "active" : ""}`}>
              <li>
                <a href={`${import.meta.env.BASE_URL}#inicio`}className="btn-nav"  onClick={closeMenu}>
                  Inicio
                </a>
              </li>
              <li>
                <a href={`${import.meta.env.BASE_URL}#productos`}className="btn-nav"  onClick={closeMenu}>
                  Productos
                </a>
              </li>
              <li>
                <a href={`${import.meta.env.BASE_URL}#beneficios`} className="btn-nav" onClick={closeMenu}>
                  Beneficios
                </a>
              </li>
              <li>
                <Link to="/garantias" className="btn-nav" onClick={closeMenu}>
                  Garantías
                </Link>
              </li>
              <li>
                <a href={`${import.meta.env.BASE_URL}#testimonios`}className="btn-nav"  onClick={closeMenu}>
                  Testimonios
                </a>
              </li>
              <li>
                <a href={`${import.meta.env.BASE_URL}#contacto`} className="btn-nav" onClick={closeMenu}>
                  Contáctanos
                </a>
              </li>
            </ul>
          </div>
          {/* Botón hamburguesa animado y accesible */}
          <button
            className={`menu-toggle ${isMenuOpen ? "active" : ""}`}
            onClick={toggleMenu}
            aria-label={isMenuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={isMenuOpen}
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === "Enter" || e.key === " ") toggleMenu();
            }}
          >
            <span className="menu-icon">
              <span className="menu-bar" />
              <span className="menu-bar" />
              <span className="menu-bar" />
            </span>
          </button>
        </nav>
      </header>
    </>
  );
}
