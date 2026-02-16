import React, { useEffect } from "react";
import Navbar from "../components/Navbar.jsx";
import Garantias from "../components/Garantias.jsx";
import "../styles.css";

export default function GarantiasPage() {
  useEffect(() => {
    const elements = document.querySelectorAll("[data-animate]");
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-in");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    );

    elements.forEach(el => {
      el.classList.add("animate-on-scroll");
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <Navbar />
      <section className="page-hero" data-animate="fade-up">
        <div className="container page-hero-content">
          <h1>Garantías y Términos</h1>
          <p>
            Conoce nuestras políticas de garantía, devoluciones y seguridad para compras
            en línea.
          </p>
          <a href={`${import.meta.env.BASE_URL}#inicio`} className="btn-secondary page-back">
            Volver al inicio
          </a>
        </div>
      </section>
      <Garantias />
      <footer className="footer">
        <div className="container footer-container">
          <p>© {new Date().getFullYear()} Phone Colombia. Todos los derechos reservados.</p>
          <p>Hecho con ❤️ en Colombia</p>
        </div>
      </footer>
    </>
  );
}
