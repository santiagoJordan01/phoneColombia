import { useRef, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Hero() {
  const videoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(true); // Estado del mute
  const [videoSrc, setVideoSrc] = useState(null);

  useEffect(() => {
    // Intentar cargar URL dinámica del hero desde la tabla `site_settings`
    (async () => {
      try {
        const { data, error } = await supabase.from('site_settings').select('value').eq('key', 'hero_video_url').limit(1).maybeSingle();
        if (!error && data && data.value) {
          const v = data.value;
          // Si es URL absoluta
          if (/^https?:\/\//i.test(v)) {
            setVideoSrc(v);
            return;
          }
          // Si es ruta relativa dentro del bucket 'hero', obtener publicUrl
          try {
            const { data: publicData } = supabase.storage.from('hero').getPublicUrl(v);
            if (publicData?.publicUrl) setVideoSrc(publicData.publicUrl);
            else setVideoSrc(v);
          } catch (e) {
            setVideoSrc(v);
          }
        }
      } catch (e) {
        // ignore y usar valor por defecto
      }
    })();

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

  const toggleMute = (e) => {
    e.stopPropagation(); // Evita que el click también pause/reproduzca el video
    const video = videoRef.current;
    if (video) {
      const newMutedState = !video.muted;
      video.muted = newMutedState;
      setIsMuted(newMutedState);
    }
  };

  return (
    <section id="inicio" className="hero hero--fullscreen">
      <video
        className="hero-video"
        ref={videoRef}
        src={videoSrc || `${import.meta.env.BASE_URL}imagenes/Hero/phonecolombiavideohero.mp4`}
        autoPlay
        muted
        loop
        playsInline
        onClick={handleVideoClick}
        style={{ cursor: "pointer" }}
        aria-hidden="true"
      />

      {/* Botón de control de sonido */}
      <button
        className="hero-sound-control"
        onClick={toggleMute}
        aria-label={isMuted ? "Activar sonido" : "Silenciar"}
        title={isMuted ? "Activar sonido" : "Silenciar"}
      >
        {isMuted ? (
          // Ícono de altavoz tachado (mute)
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
          </svg>
        ) : (
          // Ícono de altavoz con ondas (sonido activo)
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77 0-4.28-2.99-7.86-7-8.77z"/>
          </svg>
        )}
      </button>

      <div className="hero-overlay" data-animate="fade-left">
        <div className="hero-container">
          <div className="hero-text page-hero-content">
            <h1>TU ECOSISTEMA APPLE</h1>
            <div className="hero-buttons">
              <a href="#productos" className="btn-primary">Ver productos</a>
              <a href="/garantias" className="btn-secondary">Garantías</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}