import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import DailyReportDocument from "../components/inventario/DailyReportDocument.jsx";
import SellerReportDocument from "../components/inventario/SellerReportDocument.jsx";
import api, { isApiConfigured } from "../lib/apiClient";
import { canViewReports } from "./inventario/shared.jsx";
import "../styles.css";

const FILTER_KEYS = ["user_id", "supplier_id", "q", "payment_method", "credit_status"];

function paramsFromSearch(searchParams) {
  const today = new Date().toISOString().slice(0, 10);
  const params = {
    from: searchParams.get("from") || searchParams.get("date") || today,
    to: searchParams.get("to") || searchParams.get("date") || today,
  };
  FILTER_KEYS.forEach((key) => {
    const value = searchParams.get(key);
    if (value) params[key] = value;
  });
  return params;
}

export default function InventarioInformePreview() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  const reportType = searchParams.get("type") === "by_seller" ? "by_seller" : "daily";
  const isBySeller = reportType === "by_seller";
  const queryParams = useMemo(() => paramsFromSearch(searchParams), [searchParams]);
  const periodLabel = queryParams.from === queryParams.to
    ? queryParams.to
    : `${queryParams.from}_${queryParams.to}`;

  const generatedAt = useMemo(
    () => new Date().toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }),
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(
        isBySeller
          ? await api.getBySellerReport(queryParams)
          : await api.getDailyReport(queryParams),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [isBySeller, queryParams]);

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
        if (canViewReports(me)) await load();
      } catch {
        api.clearToken();
        navigate("/admin");
      }
    })();
  }, [navigate, load]);

  const exportPdf = async () => {
    setExporting(true);
    try {
      const url = isBySeller
        ? api.exportBySellerReportPdfUrl(queryParams)
        : api.exportDailyReportPdfUrl(queryParams);
      const prefix = isBySeller ? "informe_por_vendedor" : "informe_diario";
      await api.downloadAuthenticated(url, `${prefix}_${periodLabel}.pdf`);
    } catch (e) {
      setError(e.message);
    } finally {
      setExporting(false);
    }
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const url = isBySeller
        ? api.exportBySellerReportExcelUrl(queryParams)
        : api.exportDailyReportExcelUrl(queryParams);
      const prefix = isBySeller ? "informe_por_vendedor" : "informe_diario";
      await api.downloadAuthenticated(url, `${prefix}_${periodLabel}.xlsx`);
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
      navigate("/admin/inventario/informes");
    }
  };

  if (!isApiConfigured || !user) {
    return (
      <div className="inv-dash inv-dash--centered">
        <div className="inv-loader" aria-label="Cargando" />
      </div>
    );
  }

  if (!canViewReports(user)) {
    return <Navigate to="/admin/inventario" replace />;
  }

  return (
    <div className="inv-report-preview">
      <div className="inv-report-preview__toolbar">
        <div className="inv-report-preview__toolbar-start">
          <button type="button" className="inv-btn inv-btn--ghost" onClick={goBack}>
            ← Volver a informes
          </button>
          <span className="inv-report-preview__hint">
            {isBySeller ? "Vista previa del informe por vendedor" : "Vista previa del informe diario"}
          </span>
        </div>
        <div className="inv-report-preview__toolbar-actions">
          <button
            type="button"
            className="inv-btn inv-btn--primary inv-btn--inline"
            onClick={() => window.print()}
            disabled={loading || !report}
          >
            Imprimir
          </button>
          <button
            type="button"
            className="inv-btn inv-btn--outline"
            onClick={exportPdf}
            disabled={loading || exporting || !report}
          >
            Guardar PDF
          </button>
          <button
            type="button"
            className="inv-btn inv-btn--outline"
            onClick={exportExcel}
            disabled={loading || exporting || !report}
          >
            Excel
          </button>
        </div>
      </div>

      <div className="inv-report-preview__body">
        {loading && (
          <div className="inv-report-preview__loading">
            <div className="inv-loader" aria-label="Cargando informe" />
          </div>
        )}
        {error && !loading && (
          <div className="inv-report-preview__error">
            <p>{error}</p>
            <button type="button" className="inv-btn inv-btn--outline" onClick={load}>Reintentar</button>
          </div>
        )}
        {!loading && !error && report && (
          <article className="inv-report-preview__paper">
            {isBySeller ? (
              <SellerReportDocument
                report={report}
                from={queryParams.from}
                to={queryParams.to}
                generatedAt={generatedAt}
              />
            ) : (
              <DailyReportDocument
                report={report}
                from={queryParams.from}
                to={queryParams.to}
                generatedAt={generatedAt}
              />
            )}
          </article>
        )}
      </div>
    </div>
  );
}
