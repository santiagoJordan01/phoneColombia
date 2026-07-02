import { formatPrice } from "../../pages/inventario/shared.jsx";

function badgeClass(statusClass) {
  if (statusClass === "badge--apartado") return "inv-remission-doc__badge inv-remission-doc__badge--apartado";
  if (statusClass === "badge--entregado") return "inv-remission-doc__badge inv-remission-doc__badge--entregado";
  return "inv-remission-doc__badge inv-remission-doc__badge--registrado";
}

function SectionHead({ number, title }) {
  return (
    <div className="inv-remission-doc__section-head">
      <span className="inv-remission-doc__section-num">{number}</span>
      <h2 className="inv-remission-doc__section-title">{title}</h2>
      <span className="inv-remission-doc__section-rule" aria-hidden="true" />
    </div>
  );
}

export default function RemissionDocument({ sale, generatedAt }) {
  if (!sale) return null;

  const payments = sale.payments || [];
  const paymentsTotal = payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  const salePrice = Number(sale.sale_price ?? 0);
  const amountPaid = Number(sale.amount_paid ?? 0);
  const paidPct = salePrice > 0 ? Math.min(100, Math.round((amountPaid / salePrice) * 100)) : 0;
  const notesSectionNum = payments.length > 0 ? "05" : "04";

  return (
    <div className="inv-remission-doc">
      <div className="inv-remission-doc__frame">
        <div className="inv-remission-doc__accent" aria-hidden="true" />

        <table className="inv-remission-doc__header">
          <tbody>
            <tr>
              <td className="inv-remission-doc__brand">
                <div className="inv-remission-doc__brand-row">
                  <img
                    src={`${import.meta.env.BASE_URL}imagenes/logo-blanco-rojo.jfif`}
                    alt=""
                    className="inv-remission-doc__logo"
                  />
                  <div className="inv-remission-doc__brand-text">
                    <p className="inv-remission-doc__brand-eyebrow">Comprobante oficial</p>
                    <p className="inv-remission-doc__brand-name">PHONE COLOMBIA</p>
                    <p className="inv-remission-doc__brand-tagline">Venta y entrega de equipos móviles</p>
                    <div className="inv-remission-doc__brand-rule" aria-hidden="true" />
                    <p className="inv-remission-doc__brand-contact">Documento interno · Respaldo de operación comercial</p>
                  </div>
                </div>
              </td>
              <td className="inv-remission-doc__doc-box">
                <p className="inv-remission-doc__doc-label">Remisión de venta</p>
                <p className="inv-remission-doc__doc-number">{sale.remission_number || "—"}</p>
                <span className={badgeClass(sale.status_class)}>
                  {sale.status_label || "Registrado"}
                </span>
              </td>
            </tr>
          </tbody>
        </table>

        <table className="inv-remission-doc__meta-row">
          <tbody>
            <tr>
              <td>
                <div className="inv-remission-doc__meta-cell">
                  <span className="inv-remission-doc__meta-label">Fecha documento</span>
                  <span className="inv-remission-doc__meta-value">{sale.document_date || "—"}</span>
                </div>
              </td>
              <td>
                <div className="inv-remission-doc__meta-cell">
                  <span className="inv-remission-doc__meta-label">Fecha impresión</span>
                  <span className="inv-remission-doc__meta-value">{generatedAt || "—"}</span>
                </div>
              </td>
              <td>
                <div className="inv-remission-doc__meta-cell">
                  <span className="inv-remission-doc__meta-label">Vendedor</span>
                  <span className="inv-remission-doc__meta-value">{sale.seller || "—"}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <section className="inv-remission-doc__section">
          <SectionHead number="01" title="Datos del cliente" />
          <div className="inv-remission-doc__grid-2">
            <div className="inv-remission-doc__info-box">
              <div className="inv-remission-doc__info-head">Información de contacto</div>
              <dl className="inv-remission-doc__info-list">
                <div><dt>Nombre</dt><dd>{sale.customer || "—"}</dd></div>
                <div><dt>Teléfono</dt><dd>{sale.customer_phone || "—"}</dd></div>
              </dl>
            </div>
            <div className="inv-remission-doc__info-box">
              <div className="inv-remission-doc__info-head">Estado del documento</div>
              <dl className="inv-remission-doc__info-list">
                <div><dt>Estado</dt><dd>{sale.status_label || "—"}</dd></div>
                <div><dt>Nº remisión</dt><dd className="inv-remission-doc__mono">{sale.remission_number || "—"}</dd></div>
              </dl>
            </div>
          </div>
        </section>

        <section className="inv-remission-doc__section">
          <SectionHead number="02" title="Equipo entregado / reservado" />
          <div className="inv-remission-doc__product-box">
            <div className="inv-remission-doc__product-head">
              <p className="inv-remission-doc__product-tag">Detalle del producto</p>
              <p className="inv-remission-doc__product-name">{sale.item || "—"}</p>
            </div>
            <dl className="inv-remission-doc__product-specs">
              <div>
                <dt>IMEI / Código</dt>
                <dd className="inv-remission-doc__mono">{sale.imei || "—"}</dd>
              </div>
              <div>
                <dt>Color</dt>
                <dd>{sale.color || "—"}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="inv-remission-doc__section">
          <SectionHead number="03" title="Resumen financiero" />
          <div className="inv-remission-doc__finance">
            <div className="inv-remission-doc__progress">
              <div className="inv-remission-doc__progress-labels">
                <span>Avance de pago</span>
                <strong>{paidPct}% abonado</strong>
              </div>
              <div className="inv-remission-doc__progress-track" role="progressbar" aria-valuenow={paidPct} aria-valuemin={0} aria-valuemax={100}>
                <div className="inv-remission-doc__progress-fill" style={{ width: `${paidPct}%` }} />
              </div>
            </div>
            <table className="inv-remission-doc__summary">
              <tbody>
                <tr className="inv-remission-doc__summary-row--price">
                  <td>Precio acordado</td>
                  <td>{formatPrice(salePrice)}</td>
                </tr>
                <tr className="inv-remission-doc__summary-row--paid">
                  <td>Total pagado a la fecha</td>
                  <td>{formatPrice(amountPaid)}</td>
                </tr>
                <tr className="inv-remission-doc__summary-row--due">
                  <td>Saldo pendiente</td>
                  <td>{formatPrice(sale.amount_due ?? 0)}</td>
                </tr>
              </tbody>
            </table>
            <p className="inv-remission-doc__payment-method">
              Método principal: <strong>{sale.payment_method_label || "—"}</strong>
              {sale.credit_payment_method && (
                <> · Financiera / crédito: <strong>{sale.credit_payment_method}</strong></>
              )}
            </p>
          </div>
        </section>

        {payments.length > 0 && (
          <section className="inv-remission-doc__section">
            <SectionHead number="04" title="Detalle de pagos" />
            <div className="inv-remission-doc__table-wrap">
              <table className="inv-remission-doc__payments">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Método</th>
                    <th className="inv-remission-doc__th-num">Monto</th>
                    <th>Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment, index) => (
                    <tr key={`${payment.paid_at}-${index}`}>
                      <td>{payment.paid_at || "—"}</td>
                      <td>{payment.method || "—"}</td>
                      <td className="inv-remission-doc__num">{formatPrice(payment.amount ?? 0)}</td>
                      <td>{payment.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>Total abonado</td>
                    <td className="inv-remission-doc__num">{formatPrice(paymentsTotal)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        )}

        {sale.notes?.trim() && (
          <section className="inv-remission-doc__section">
            <SectionHead number={notesSectionNum} title="Observaciones" />
            <div className="inv-remission-doc__notes">{sale.notes.trim()}</div>
          </section>
        )}

        <div className="inv-remission-doc__signatures">
          <div className="inv-remission-doc__sign-block">
            <div className="inv-remission-doc__sign-area" aria-hidden="true" />
            <div className="inv-remission-doc__sign-line">Firma del cliente</div>
            <p className="inv-remission-doc__sign-hint">Nombre legible · Documento de identidad</p>
          </div>
          <div className="inv-remission-doc__sign-block">
            <div className="inv-remission-doc__sign-area" aria-hidden="true" />
            <div className="inv-remission-doc__sign-line">Phone Colombia · Vendedor</div>
            <p className="inv-remission-doc__sign-hint">Nombre legible · Cargo</p>
          </div>
        </div>

        <footer className="inv-remission-doc__footer">
          <div className="inv-remission-doc__footer-bar" aria-hidden="true">
            <span className="inv-remission-doc__footer-bar-orange" />
            <span className="inv-remission-doc__footer-bar-slate" />
          </div>
          <p className="inv-remission-doc__footer-title">Comprobante interno de venta o apartado</p>
          <p className="inv-remission-doc__footer-note">
            No sustituye factura electrónica DIAN. Conserve este documento como respaldo de la operación comercial.
          </p>
          <p className="inv-remission-doc__footer-ref">
            {sale.remission_number || "—"} · Generado {generatedAt || "—"}
          </p>
        </footer>
      </div>
    </div>
  );
}
