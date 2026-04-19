import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  // refs para scroll y estado del menú (evitan re-render innecesario)
  const lastScrollY = useRef(typeof window !== "undefined" ? window.scrollY : 0);
  const ticking = useRef(false);
  const menuOpenRef = useRef(isMenuOpen);

  useEffect(() => {
    menuOpenRef.current = isMenuOpen;
  }, [isMenuOpen]);

  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY;

      // estado de fondo (sombra / tamaño)
      setIsScrolled(currentY > 50);

      // si el menú móvil está abierto mantenemos visible el header
      if (menuOpenRef.current) {
        setIsHeaderVisible(true);
        lastScrollY.current = currentY;
        return;
      }

      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          const delta = currentY - lastScrollY.current;
          const deltaThreshold = 10; // evita flicker
          const hideAfter = 50; // umbral para empezar a ocultar

          if (Math.abs(delta) > deltaThreshold) {
            // No ocultar si el foco está dentro del header (accesibilidad)
            const headerEl = document.querySelector("header.header");
            const active = document.activeElement;
            const activeInsideHeader = headerEl && active && headerEl.contains(active);

            if (delta > 0 && currentY > hideAfter && !activeInsideHeader) {
              setIsHeaderVisible(false);
            } else if (delta < 0) {
              setIsHeaderVisible(true);
            }
            lastScrollY.current = currentY;
          }
          ticking.current = false;
        });
        ticking.current = true;
      }
    };

    lastScrollY.current = typeof window !== "undefined" ? window.scrollY : 0;
    setIsScrolled(lastScrollY.current > 50);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // bloquear/desbloquear scroll del body cuando el menú está abierto
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
      document.body.classList.add("mobile-menu-open");
    } else {
      document.body.style.overflow = "";
      document.body.classList.remove("mobile-menu-open");
    }

    return () => {
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

      <header className={`header ${isScrolled ? "scrolled" : ""}${isHeaderVisible ? "" : " header-hidden"}`}>
        <nav className={`navbar ${isScrolled ? "scrolled" : ""}`}>
          <div className="nav-container" style={{ width: "100%" }}>
            <a
              className="logo"
              href="#inicio"
              onClick={closeMenu}
            >
              <img
                src={`${import.meta.env.BASE_URL}imagenes/logo-blanco-rojo.jfif`}
                alt="Phone Colombia Logo"
                className="imagenLogo"
              />
            </a>
            <ul className={`nav-links ${isMenuOpen ? "active" : ""}`}>
              <li>
                <a
                  href="#inicio"
                  className="btn-nav"
                  onClick={closeMenu}
                >
                  Inicio
                </a>
              </li>
              <li>
                <a
                  href="#testimonios"
                  className="btn-nav"
                  onClick={closeMenu}
                >
                  Testimonios
                </a>
              </li>

              <li>
                <a
                  href="#promociones"
                  className="btn-nav"
                  onClick={closeMenu}
                >
                  Promociones
                </a>
              </li>

              <li>
                <a
                  href="#productos"
                  className="btn-nav"
                  onClick={closeMenu}
                >
                  Productos
                </a>
              </li>
              <li>
                <a
                  href="#ubicacion"
                  className="btn-nav"
                  onClick={closeMenu}
                >
                  Ubicación
                </a>
              </li>
              {/*
              <li>
                <a href={`${import.meta.env.BASE_URL}#beneficios`} className="btn-nav" onClick={closeMenu}>
                  Beneficios
                </a>
              </li>
              */}
            </ul>
          </div>
          {/* Botón hamburguesa animado y accesible */}
          <button
            className={`menu-toggle ${isMenuOpen ? "active" : ""}`}
            onClick={toggleMenu}
            aria-label={isMenuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={isMenuOpen}
            tabIndex={0}
            onKeyDown={(e) => {
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
