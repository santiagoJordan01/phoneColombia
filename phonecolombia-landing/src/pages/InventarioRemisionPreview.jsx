import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import RemissionDocument from "../components/inventario/RemissionDocument.jsx";
import api, { isApiConfigured } from "../lib/apiClient";
import { canViewRemissions } from "./inventario/shared.jsx";
import "../styles.css";

export default function InventarioRemisionPreview() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const saleId = searchParams.get("sale_id");
  const [user, setUser] = useState(null);
  const [remission, setRemission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  const generatedAt = useMemo(
    () => new Date().toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }),
    [],
  );

  const load = useCallback(async () => {
    if (!saleId) {
      setError("Falta el identificador de la venta.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRemission(await api.getRemissionDocument(saleId));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [saleId]);

  useEffect(() => {
    if (!isApiConfigured) return;
    (async () => {
      if (!api.getToken()) {
        navigate("/admin");
        return;
      }
      try {
        const me = await api.me();
        setUser(me);
        if (canViewRemissions(me)) await load();
      } catch {
        api.clearToken();
        navigate("/admin");
      }
    })();
  }, [navigate, load]);

  const exportPdf = async () => {
    if (!saleId || !remission?.remission_number) return;
    setExporting(true);
    try {
      await api.downloadAuthenticated(
        api.exportRemissionPdfUrl(saleId),
        `remision_${remission.remission_number.replace(/\//g, "-")}.pdf`,
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setExporting(false);
    }
  };

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/admin/inventario/ventas");
    }
  };

  if (!isApiConfigured || !user) {
    return (
      <div className="inv-dash inv-dash--centered">
        <div className="inv-loader" aria-label="Cargando" />
      </div>
    );
  }

  if (!canViewRemissions(user)) {
    return <Navigate to="/admin/inventario" replace />;
  }

  return (
    <div className="inv-report-preview">
      <div className="inv-report-preview__toolbar">
        <div className="inv-report-preview__toolbar-start">
          <button type="button" className="inv-btn inv-btn--ghost" onClick={goBack}>
            ← Volver
          </button>
          <span className="inv-report-preview__hint">
            Vista previa de remisión
            {remission?.remission_number ? ` · ${remission.remission_number}` : ""}
          </span>
        </div>
        <div className="inv-report-preview__toolbar-actions">
          <button
            type="button"
            className="inv-btn inv-btn--primary inv-btn--inline"
            onClick={() => window.print()}
            disabled={loading || !remission}
          >
            Imprimir
          </button>
          <button
            type="button"
            className="inv-btn inv-btn--outline"
            onClick={exportPdf}
            disabled={loading || exporting || !remission}
          >
            Guardar PDF
          </button>
        </div>
      </div>

      <div className="inv-report-preview__body">
        {loading && (
          <div className="inv-report-preview__loading">
            <div className="inv-loader" aria-label="Cargando remisión" />
          </div>
        )}
        {error && !loading && (
          <div className="inv-report-preview__error">
            <p>{error}</p>
            {saleId && (
              <button type="button" className="inv-btn inv-btn--outline" onClick={load}>Reintentar</button>
            )}
          </div>
        )}
        {!loading && !error && remission && (
          <article className="inv-report-preview__paper inv-report-preview__paper--remission">
            <RemissionDocument sale={remission} generatedAt={generatedAt} />
          </article>
        )}
      </div>
    </div>
  );
}
