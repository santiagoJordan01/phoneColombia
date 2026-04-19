import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar.jsx";
import Hero from "./components/Hero.jsx";
import Productos from "./components/Productos.jsx";
import Clientes from "./components/Clientes.jsx";
import Testimonios from "./components/Testimonios.jsx";
import Promociones from "./components/Promociones.jsx";
import Contactanos from "./components/Contactanos.jsx";
import Ubicacion from "./components/Ubicacion.jsx";
import GarantiasPage from "./pages/GarantiasPage.jsx";
import FloatingSocialButton from "./components/FloatingSocialButton.jsx";
import Admin from "./pages/Admin.jsx";
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
      <Productos />
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
      <Route path="/admin" element={<Admin />} />
      <Route path="/garantias" element={<GarantiasPage />} />
    </Routes>
  );
}

export default App;
