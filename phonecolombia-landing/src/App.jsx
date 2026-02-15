
import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Hero from "./components/Hero.jsx";
import Beneficios from "./components/Beneficios.jsx";
import Producto from "./components/Productos.jsx";
import Clientes from "./components/Clientes.jsx";
import Testimonios from "./components/Testimonios.jsx";
import Contactanos from "./components/Contactanos.jsx";
import Ubicacion from "./components/Ubicacion.jsx";
import GarantiasPage from "./pages/GarantiasPage.jsx";
import "./App.css";
import "./styles.css";

function Home() {
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
      <Hero />
      <Testimonios />

      <Beneficios />
      <section id="productos" className="productos-section">
        <div className="container">
          <h2 className="section-title" data-animate="fade-up">Nuestros Productos Destacados</h2>
          <div className="productos-grid" data-animate="stagger">
            {/* Ejemplo de productos destacados */}
            <Producto
              imagen="/imagenes/images.jfif"
              nombre="iPhone 14 Pro Max"
              descripcion="Pantalla Super Retina XDR, chip A16 Bionic, cámara Pro."
              precio="6.500.000"
            />
            <Producto
              imagen="/imagenes/logo-blanco-rojo.jfif"
              nombre="Samsung Galaxy S23 Ultra"
              descripcion="Cámara de 200MP, S Pen integrado, batería de larga duración."
              precio="5.800.000"
            />
            <Producto
              imagen="/imagenes/images.jfif"
              nombre="Xiaomi 13T Pro"
              descripcion="Carga ultra rápida, pantalla AMOLED, gran rendimiento."
              precio="2.900.000"
            />
          </div>
        </div>
      </section>
      <Clientes />
      <Ubicacion />
      <Contactanos />
      <footer className="footer">
        <div className="container footer-container">
          <p>© {new Date().getFullYear()} Phone Colombia. Todos los derechos reservados.</p>
          <p>Hecho con ❤️ en Colombia</p>
        </div>
      </footer>
    </>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/garantias" element={<GarantiasPage />} />
    </Routes>
  );
}

export default App;
