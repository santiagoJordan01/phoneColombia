import React, { useState, useEffect } from "react";
import api from "../lib/apiClient";
import "../styles.css";

export default function Garantias() {
  const [allOpen, setAllOpen] = useState(false);
  const [items, setItems] = useState([
    {
      title: "Nuevos: Celulares",
      text1:
        "Cobertura por garantía legal en Colombia (Ley 1480 de 2011) por calidad, idoneidad y seguridad, más garantía comercial del fabricante. En Apple, aplica además la Garantía Limitada Apple de 1 año sin afectar tus derechos legales como consumidor.",
      text2:
        "Excepciones: daños por golpes, líquidos/humedad, uso indebido, intervención técnica no autorizada, software alterado (jailbreak/root) y desgaste normal de consumibles."
    },
    {
      title: "Nuevos: Tablets",
      text1:
        "Garantía legal en Colombia por fallas de fábrica y no conformidad del producto, con diagnóstico y gestión por canales autorizados. Para Apple iPad, aplica también la garantía comercial de Apple conforme a sus términos.",
      text2:
        "Excepciones: daño físico o por líquidos, uso de accesorios no certificados que causen daño, manipulación de terceros no autorizados y fallas derivadas de uso contrario al manual."
    },
    {
      title: "Nuevos: Computadores",
      text1:
        "Garantía legal en Colombia sobre componentes y funcionamiento del equipo por defectos de fabricación. Incluye evaluación técnica y solución (reparación, reposición o devolución) según corresponda por ley.",
      text2:
        "Excepciones: golpes, sobrecargas eléctricas, humedad, modificación interna no autorizada, malware o software instalado sin soporte que cause la falla."
    },
    {
      title: "Seminuevos: Celulares",
      text1:
        "Cobertura por garantía legal para producto seminuevo/usado con término informado previamente al consumidor en la venta (factura/orden), incluyendo funcionamiento básico y conformidad con el estado reportado.",
      text2:
        "Excepciones: desgaste estético normal informado, batería con ciclo de uso propio del seminuevo, golpes, líquidos y daños causados después de la entrega por uso indebido."
    },
    {
      title: "Seminuevos: Tablets",
      text1:
        "Garantía sobre fallas técnicas no atribuibles al uso posterior del cliente y consistencia con el estado técnico informado al momento de la compra.",
      text2:
        "Excepciones: pantalla rota por accidente, humedad, manipulación no autorizada, daños por accesorios de terceros y desgaste normal por uso."
    },
    {
      title: "Seminuevos: Computadores",
      text1:
        "Cobertura limitada en componentes esenciales conforme al diagnóstico y estado informados en la venta, con garantía legal para seminuevos en el término comunicado al consumidor.",
      text2:
        "Excepciones: baterías y consumibles con desgaste propio, daños por golpes o líquidos, sobrecargas, modificaciones de hardware/software no autorizadas y mal uso."
    }
  ]);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getSetting("garantias");
        if (data?.value) {
          try {
            const parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
            if (Array.isArray(parsed) && parsed.length > 0) setItems(parsed);
          } catch (e) {
            // ignore parse error, mantenemos defaults
          }
        }
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  const toggleCard = () => {
    setAllOpen(prev => !prev);
  };

  return (
    <section id="garantias" className="garantias-section" data-animate="fade-up">
      <div className="container">
        <h2 className="section-title" data-animate="fade-up">Garantías y Términos</h2>
        <div className="garantias-grid" data-animate="stagger">
          {items.map((item, index) => (
            <div
              key={item.title + index}
              className={`garantia-card ${allOpen ? "expanded" : ""}`}
              data-animate="fade-up"
              onClick={toggleCard}
              onKeyDown={event => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggleCard();
                }
              }}
              role="button"
              tabIndex={0}
              aria-expanded={allOpen}
            >
              <h3>{item.title}</h3>
              <div className="garantia-card-content">
                <p>{item.text1}</p>
                <p>
                  <strong>Excepciones:</strong> {item.text2.replace("Excepciones: ", "")}
                </p>
              </div>
              <div className="garantia-more" aria-hidden="true">
                <span>{allOpen ? "Ver menos" : "Ver más"}</span>
                <svg viewBox="0 0 24 24" className="garantia-more-icon">
                  <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
