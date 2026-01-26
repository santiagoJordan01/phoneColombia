export default function Hero() {
  return (
    <section id="inicio" className="hero">
      <div className="hero-container">
        <div className="hero-text">
          <h1>
            Los mejores <span>smartphones</span> en Colombia
          </h1>
          <p>
            Tecnología original, garantía y los mejores precios del mercado.
          </p>

          <div className="hero-buttons">
            <a href="#productos" className="btn-primary">
              Ver productos
            </a>
            <a href="#contacto" className="btn-secondary">
              Contáctanos
            </a>
          </div>
        </div>

        <div className="hero-image">
          <img src="/public/imagenes/images-2.webp" alt="Smartphone" />
        </div>
      </div>
    </section>
  );
}
