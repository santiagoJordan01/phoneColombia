import { useRef, useEffect } from "react";

export default function Hero() {
  const videoRef = useRef(null);

  useEffect(() => {
    document.body.classList.add("has-hero");
    const header = document.querySelector('header');
    const prev = header
      ? {
          position: header.style.position,
          top: header.style.top,
          left: header.style.left,
          width: header.style.width,
          zIndex: header.style.zIndex,
        }
      : null;

    if (header) {
      header.style.position = 'absolute';
      header.style.top = '0';
      header.style.left = '0';
      header.style.width = '100%';
      header.style.zIndex = '1100';
    }

    return () => {
      document.body.classList.remove("has-hero");
      if (header && prev) {
        header.style.position = prev.position || '';
        header.style.top = prev.top || '';
        header.style.left = prev.left || '';
        header.style.width = prev.width || '';
        header.style.zIndex = prev.zIndex || '';
      }
    };
  }, []);

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
    <section id="inicio" className="hero hero--fullscreen">
      {/* Background video removed (hero-bg) */}

      {/* Foreground video (visible, clickable) */}
      <video
        className="hero-video"
        ref={videoRef}
        src={`${import.meta.env.BASE_URL}imagenes/Hero/phonecolombiavideohero.mp4`}
        autoPlay
        muted
        loop
        playsInline
        onClick={handleVideoClick}
        style={{ cursor: "pointer" }}
        aria-hidden="true"
      />

      <div className="hero-overlay" data-animate="fade-left">
        <div className="hero-container">
          <div className="hero-text page-hero-content">
            <h1>TU ECOSISTEMA APPLE</h1>

            <div className="hero-buttons">
              <a href="#productos" className="btn-primary">
                Ver productos
              </a>
              <a href="/garantias" className="btn-secondary">
                Garantías
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
