import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import CashReportDocument from "../components/inventario/CashReportDocument.jsx";
import DailyReportDocument from "../components/inventario/DailyReportDocument.jsx";
import InventoryIntakeReportDocument from "../components/inventario/InventoryIntakeReportDocument.jsx";
import ReceivablesReportDocument from "../components/inventario/ReceivablesReportDocument.jsx";
import RemissionReportDocument from "../components/inventario/RemissionReportDocument.jsx";
import SellerReportDocument from "../components/inventario/SellerReportDocument.jsx";
import ServiceTicketsReportDocument from "../components/inventario/ServiceTicketsReportDocument.jsx";
import api, { isApiConfigured } from "../lib/apiClient";
import InvIcon from "../components/inventario/InvIcon.jsx";
import { canViewReports } from "./inventario/shared.jsx";
import "../styles.css";

const FILTER_KEYS = ["user_id", "supplier_id", "q", "payment_method", "credit_status", "service_status", "workshop"];

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

function receivablesParamsFromSearch(searchParams) {
  const params = {};
  FILTER_KEYS.forEach((key) => {
    const value = searchParams.get(key);
    if (value) params[key] = value;
  });
  return params;
}

function resolveReportType(searchParams) {
  const type = searchParams.get("type");
  if (type === "by_seller") return "by_seller";
  if (type === "by_remission") return "by_remission";
  if (type === "cash_register") return "cash_register";
  if (type === "receivables") return "receivables";
  if (type === "inventory_intake") return "inventory_intake";
  if (type === "service_tickets") return "service_tickets";
  return "daily";
}

export default function InventarioInformePreview() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  const reportType = resolveReportType(searchParams);
  const isBySeller = reportType === "by_seller";
  const isByRemission = reportType === "by_remission";
  const isCashRegister = reportType === "cash_register";
  const isReceivables = reportType === "receivables";
  const isInventoryIntake = reportType === "inventory_intake";
  const isServiceTickets = reportType === "service_tickets";
  const queryParams = useMemo(
    () => (isReceivables ? receivablesParamsFromSearch(searchParams) : paramsFromSearch(searchParams)),
    [isReceivables, searchParams],
  );
  const periodLabel = queryParams.from === queryParams.to
    ? queryParams.to
    : `${queryParams.from}_${queryParams.to}`;
  const exportFileLabel = isReceivables
    ? new Date().toISOString().slice(0, 10)
    : periodLabel;

  const generatedAt = useMemo(
    () => new Date().toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }),
    [],
  );

  const previewHint = isReceivables
    ? "Vista previa del informe de cartera"
    : isCashRegister
      ? "Vista previa del cuadre de caja"
      : isByRemission
        ? "Vista previa del informe por remisión"
        : isInventoryIntake
          ? "Vista previa del informe de ingresos"
          : isServiceTickets
            ? "Vista previa de servicio técnico"
            : isBySeller
              ? "Vista previa del informe por vendedor"
              : "Vista previa del informe diario";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isReceivables) {
        setReport(await api.getReceivablesReport(queryParams));
      } else if (isCashRegister) {
        setReport(await api.getCashRegisterReport(queryParams));
      } else if (isBySeller) {
        setReport(await api.getBySellerReport(queryParams));
      } else if (isByRemission) {
        setReport(await api.getByRemissionReport(queryParams));
      } else if (isInventoryIntake) {
        setReport(await api.getInventoryIntakeReport(queryParams));
      } else if (isServiceTickets) {
        setReport(await api.getServiceTicketsReport(queryParams));
      } else {
        setReport(await api.getDailyReport(queryParams));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [isBySeller, isByRemission, isCashRegister, isReceivables, isInventoryIntake, isServiceTickets, queryParams]);

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
      let url;
      let prefix;
      if (isReceivables) {
        url = api.exportReceivablesReportPdfUrl(queryParams);
        prefix = "cartera";
      } else if (isCashRegister) {
        url = api.exportCashRegisterReportPdfUrl(queryParams);
        prefix = "cuadre_caja";
      } else if (isBySeller) {
        url = api.exportBySellerReportPdfUrl(queryParams);
        prefix = "informe_por_vendedor";
      } else if (isByRemission) {
        url = api.exportByRemissionReportPdfUrl(queryParams);
        prefix = "informe_por_remision";
      } else if (isInventoryIntake) {
        url = api.exportInventoryIntakeReportPdfUrl(queryParams);
        prefix = "ingresos_inventario";
      } else if (isServiceTickets) {
        url = api.exportServiceTicketsReportPdfUrl(queryParams);
        prefix = "servicio_tecnico";
      } else {
        url = api.exportDailyReportPdfUrl(queryParams);
        prefix = "informe_diario";
      }
      await api.downloadAuthenticated(url, `${prefix}_${exportFileLabel}.pdf`);
    } catch (e) {
      setError(e.message);
    } finally {
      setExporting(false);
    }
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      let url;
      let prefix;
      if (isReceivables) {
        url = api.exportReceivablesReportExcelUrl(queryParams);
        prefix = "cartera";
      } else if (isCashRegister) {
        url = api.exportCashRegisterReportExcelUrl(queryParams);
        prefix = "cuadre_caja";
      } else if (isBySeller) {
        url = api.exportBySellerReportExcelUrl(queryParams);
        prefix = "informe_por_vendedor";
      } else if (isByRemission) {
        url = api.exportByRemissionReportXlsUrl(queryParams);
        prefix = "Reporte de remisiones de venta";
      } else if (isInventoryIntake) {
        url = api.exportInventoryIntakeReportExcelUrl(queryParams);
        prefix = "ingresos_inventario";
      } else if (isServiceTickets) {
        url = api.exportServiceTicketsReportExcelUrl(queryParams);
        prefix = "servicio_tecnico";
      } else {
        url = api.exportDailyReportExcelUrl(queryParams);
        prefix = "informe_diario";
      }
      const extension = isByRemission ? "xls" : "xlsx";
      await api.downloadAuthenticated(url, `${prefix}_${exportFileLabel}.${extension}`);
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
            <InvIcon name="arrow-left" />
            Volver a informes
          </button>
          <span className="inv-report-preview__hint">{previewHint}</span>
        </div>
        <div className="inv-report-preview__toolbar-actions">
          <button
            type="button"
            className="inv-btn inv-btn--primary inv-btn--inline"
            onClick={() => window.print()}
            disabled={loading || !report}
          >
            <InvIcon name="printer" />
            Imprimir
          </button>
          <button
            type="button"
            className="inv-btn inv-btn--outline"
            onClick={exportPdf}
            disabled={loading || exporting || !report}
          >
            <InvIcon name="file-text" />
            Guardar PDF
          </button>
          <button
            type="button"
            className="inv-btn inv-btn--outline"
            onClick={exportExcel}
            disabled={loading || exporting || !report}
          >
            <InvIcon name="spreadsheet" />
            {isByRemission ? "Excel (.xls)" : "Excel"}
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
            {isReceivables ? (
              <ReceivablesReportDocument report={report} generatedAt={generatedAt} />
            ) : isCashRegister ? (
              <CashReportDocument
                report={report}
                from={queryParams.from}
                to={queryParams.to}
                generatedAt={generatedAt}
              />
            ) : isBySeller ? (
              <SellerReportDocument
                report={report}
                from={queryParams.from}
                to={queryParams.to}
                generatedAt={generatedAt}
              />
            ) : isByRemission ? (
              <RemissionReportDocument
                report={report}
                from={queryParams.from}
                to={queryParams.to}
                generatedAt={generatedAt}
              />
            ) : isInventoryIntake ? (
              <InventoryIntakeReportDocument report={report} generatedAt={generatedAt} />
            ) : isServiceTickets ? (
              <ServiceTicketsReportDocument report={report} generatedAt={generatedAt} />
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
