import { useEffect, useState } from "react";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import "./App.css";

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  // Navbar scroll effect
  useEffect(() => {
    const onScroll = () => {
      const navbar = document.getElementById("navbar");
      if (!navbar) return;
      if (window.scrollY > 50) navbar.classList.add("scrolled");
      else navbar.classList.remove("scrolled");
    };

    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Counter animation
  useEffect(() => {
    const target = 15000;
    const interval = setInterval(() => {
      setCount((prev) => {
        if (prev >= target) {
          clearInterval(interval);
          return target;
        }
        return prev + 150;
      });
    }, 20);

    return () => clearInterval(interval);
  }, []);

  // Testimonials auto slide
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % 3);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Background animado */}
      <div className="bg-animated">
        <div className="bg-circle circle1"></div>
        <div className="bg-circle circle2"></div>
        <div className="bg-circle circle3"></div>
      </div>

      {/* Navbar */}
      <Navbar menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

      {/* Hero */}
      <Hero />

      {/* Stats */}
      <section className="stats">
        <div className="stats-container">
          <div className="stat-item">
            <h3>{count.toLocaleString()}+</h3>
            <p>Clientes Satisfechos</p>
          </div>
          <div className="stat-item">
            <h3>500+</h3>
            <p>Modelos Disponibles</p>
          </div>
          <div className="stat-item">
            <h3>24/7</h3>
            <p>Soporte Continuo</p>
          </div>
        </div>
      </section>
    </>
  );
}

export default App;
