import InvIcon from "./InvIcon.jsx";

export function ReportPreviewButton({ onClick, disabled, children = "Vista previa" }) {
  return (
    <button type="button" className="inv-btn inv-btn--primary inv-btn--inline" onClick={onClick} disabled={disabled}>
      <InvIcon name="eye" />
      {children}
    </button>
  );
}

export function ReportPdfButton({ onClick, disabled, children = "Exportar PDF" }) {
  return (
    <button type="button" className="inv-btn inv-btn--outline" onClick={onClick} disabled={disabled}>
      <InvIcon name="file-text" />
      {children}
    </button>
  );
}

export function ReportExcelButton({ onClick, disabled, children = "Exportar Excel" }) {
  return (
    <button type="button" className="inv-btn inv-btn--outline" onClick={onClick} disabled={disabled}>
      <InvIcon name="spreadsheet" />
      {children}
    </button>
  );
}
