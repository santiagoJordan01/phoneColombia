import { useRef } from "react";

export default function Hero() {
  const videoRef = useRef(null);

  const handleVideoClick = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };

  return (
    <section id="inicio" className="hero">
      <div className="hero-container">


          <div className="hero-image" data-animate="fade-right">
          <video
            ref={videoRef}
            src={`${import.meta.env.BASE_URL}imagenes/Hero/phonecolombiavideohero.mp4`}
            autoPlay
            loop
            playsInline
            onClick={handleVideoClick}
            style={{ cursor: "pointer" }}
          >
            Tu navegador no soporta la reproducción de video.
          </video>
        </div>
        <div className="hero-text" data-animate="fade-left">
          <h1>
            Bienvenidos a la mejor tienda de <span>telefonía móvil</span> en Colombia
          </h1>
          <p>
            Especialistas en productos del ecosistema Apple: iPhone, AirPods, Apple Watch y más, con garantía y los mejores precios del mercado.
          </p>

          <div className="hero-buttons">
            <a href="#productos" className="btn-primary">
              Ver productos
            </a>
            <a href="/phonecolombia-landing/garantias" className="btn-secondary">
              Garantías
            </a>
          </div>
        </div>

      
      </div>
    </section>
  );
}
