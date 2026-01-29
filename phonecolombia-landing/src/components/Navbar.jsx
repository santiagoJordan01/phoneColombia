import { useState, useEffect } from "react";

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

    // Bloquear scroll cuando el menú está abierto
    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.body.style.overflow = "";
    };
  }, [isMenuOpen]);

  return (
    <>
      {/* Overlay para cerrar menú al hacer clic fuera */}
      {isMenuOpen && (
        <div className="nav-overlay" onClick={closeMenu} aria-hidden="true" />
      )}

      <header className={`header ${isScrolled ? "scrolled" : ""}`}>
        <nav className="navbar container">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div className="logo">
              <img
                src="/imagenes/logo-blanco-rojo.jfif"
                alt="Phone Colombia Logo"
                className="imagenLogo"
              />
            </div>
            <ul className={`nav-links ${isMenuOpen ? "active" : ""}`}>
              <li>
                <a href="#inicio" onClick={closeMenu}>
                  Inicio
                </a>
              </li>
              <li>
                <a href="#productos" onClick={closeMenu}>
                  Productos
                </a>
              </li>
              <li>
                <a href="#beneficios" onClick={closeMenu}>
                  Beneficios
                </a>
              </li>
              <li>
                <a href="#testimonios" onClick={closeMenu}>
                  Testimonios
                </a>
              </li>
              <li>
                <a href="#contacto" className="btn-nav" onClick={closeMenu}>
                  Contáctanos
                </a>
              </li>
            </ul>
          </div>
          {/* Botón hamburguesa en parte superior derecha */}
          <button
            className={`menu-toggle ${isMenuOpen ? "active" : ""}`}
            onClick={toggleMenu}
            aria-label={isMenuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={isMenuOpen}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#333' }}>menu</span>
          </button>
        </nav>
      </header>
    </>
  );
}
