import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar.jsx";
import Hero from "./components/Hero.jsx";
import Producto from "./components/Productos.jsx";
import Clientes from "./components/Clientes.jsx";
import Testimonios from "./components/Testimonios.jsx";
import Promociones from "./components/Promociones.jsx";
import Contactanos from "./components/Contactanos.jsx";
import Ubicacion from "./components/Ubicacion.jsx";
import GarantiasPage from "./pages/GarantiasPage.jsx";
import FloatingSocialButton from "./components/FloatingSocialButton.jsx";
import "./App.css";
import "./styles.css";

function Home() {
  useEffect(() => {
    const elements = document.querySelectorAll("[data-animate]");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-in");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );

    elements.forEach((el) => {
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
      <Promociones />
      <section id="productos" className="productos-section">
        <div className="container">
          <h2 className="section-title" data-animate="fade-up">
            Productos
          </h2>
          <div className="productos-grid" data-animate="stagger">
            {/* Ejemplo de productos destacados */}
            <Producto
              imagen={`${import.meta.env.BASE_URL}imagenes/productos/iphone_15.webp`}
              nombre="iPhone 15"
              descripcion="128 gb\
              Case\
              Vidrio\
              Cargador\
              Audifonos\"
              precio="0.000.000"
            />
            <Producto
              imagen={`${import.meta.env.BASE_URL}imagenes/productos/airpods_pro.jfif`}
              nombre="AirPods 4"
              descripcion="Gran ajuste
Llamadas más nitidas
Audio espacial personalizado"
              precio="0.000.000"
            />
            <Producto
              imagen={`${import.meta.env.BASE_URL}imagenes/productos/ipad_pro.webp`}
              nombre="Ipad pro"
              descripcion="15’’\
256gb\
Wifi\
Vidrio estandar\."
              precio="0.000.000"
            />
          </div>
        </div>
      </section>
      {/* <Clientes /> */}
      <Ubicacion />
      <Contactanos />
      <footer className="footer">
        <div className="container footer-container">
          <p>
            © {new Date().getFullYear()} Phone Colombia. Todos los derechos
            reservados.
          </p>
          <p>Hecho con ❤️ en Colombia</p>
          <p className="footer-legal">
            Apple, iPhone, AirPods y Apple Watch son marcas registradas de Apple
            Inc. Phone Colombia no está afiliada, autorizada ni respaldada por
            Apple Inc.
          </p>
        </div>
      </footer>
      <FloatingSocialButton />
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
