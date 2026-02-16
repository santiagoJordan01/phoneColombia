import { useEffect, useRef, useState } from "react";
import { IconWhatsapp, IconInstagram, IconTelegram } from "./SocialIcons";

export default function FloatingSocialButton() {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = event => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = event => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div ref={wrapperRef} className={`floating-social ${isOpen ? "open" : ""}`}>
      <div className="floating-social-panel" aria-hidden={!isOpen}>
        <a
          className="floating-social-link"
          href="https://wa.me/573007190977"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="WhatsApp"
        >
          <IconWhatsapp />
        </a>
        <a
          className="floating-social-link"
          href="https://instagram.com/phonecolombiaoficial"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram"
        >
          <IconInstagram />
        </a>
        <a
          className="floating-social-link"
          href="https://t.me/phonecolombia"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Telegram"
        >
          <IconTelegram />
        </a>
      </div>

      <button
        type="button"
        className="floating-social-trigger"
        onClick={() => setIsOpen(prev => !prev)}
        aria-label={isOpen ? "Cerrar redes sociales" : "Abrir redes sociales"}
        aria-expanded={isOpen}
      >
        <span className="floating-social-label">
          {isOpen ? "Ocultar redes" : "Redes sociales"}
        </span>
        <img
          src={`${import.meta.env.BASE_URL}imagenes/logo-blanco-rojo.jfif`}
          alt="Phone Colombia"
          className="floating-social-logo"
        />
      </button>
    </div>
  );
}
