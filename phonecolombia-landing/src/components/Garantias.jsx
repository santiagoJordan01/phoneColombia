import React from "react";
import "../styles.css";

export default function Garantias() {
  return (
    <section id="garantias" className="garantias-section" data-animate="fade-up">
      <div className="container">
        <h2 className="section-title" data-animate="fade-up">Garantías y Términos</h2>
        <div className="garantias-grid" data-animate="stagger">
          <div className="garantia-card" data-animate="fade-up">
            <h3>Nuevos: Celulares</h3>
            <p>
              Garantía oficial de fábrica según marca. Cobertura por defectos de
              manufactura y soporte técnico autorizado.
            </p>
            <p>
              <strong>Excepciones:</strong> daños por golpes, humedad, manipulación
              no autorizada, uso indebido, software alterado o desgaste normal.
            </p>
          </div>
          <div className="garantia-card" data-animate="fade-up">
            <h3>Nuevos: Tablets</h3>
            <p>
              Garantía legal vigente. Revisión y reparación en centros autorizados
              conforme a políticas del fabricante.
            </p>
            <p>
              <strong>Excepciones:</strong> daños físicos, líquidos, accesorios no
              originales, intervención de terceros o fallas por mal uso.
            </p>
          </div>
          <div className="garantia-card" data-animate="fade-up">
            <h3>Nuevos: Computadores</h3>
            <p>
              Cobertura integral por fallas de hardware. Servicio técnico oficial
              y reemplazo de piezas según diagnóstico.
            </p>
            <p>
              <strong>Excepciones:</strong> golpes, sobrecargas eléctricas, humedad,
              modificaciones internas o daño por software no autorizado.
            </p>
          </div>
          <div className="garantia-card" data-animate="fade-up">
            <h3>Usados: Celulares</h3>
            <p>
              Garantía limitada de funcionamiento. Equipos certificados y probados
              antes de la entrega.
            </p>
            <p>
              <strong>Excepciones:</strong> daños estéticos, batería con desgaste,
              accesorios, golpes, líquidos o uso indebido posterior a la entrega.
            </p>
          </div>
          <div className="garantia-card" data-animate="fade-up">
            <h3>Usados: Tablets</h3>
            <p>
              Cobertura por fallas técnicas no atribuibles al uso. Diagnóstico y
              soporte local incluidos.
            </p>
            <p>
              <strong>Excepciones:</strong> pantalla rota, humedad, manipulación no
              autorizada, accesorios externos o desgaste normal.
            </p>
          </div>
          <div className="garantia-card" data-animate="fade-up">
            <h3>Usados: Computadores</h3>
            <p>
              Garantía limitada en componentes esenciales. Validación previa y
              reporte de estado físico.
            </p>
            <p>
              <strong>Excepciones:</strong> baterías con desgaste, daños por golpes,
              líquidos, sobrecargas, modificaciones o mal uso.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
