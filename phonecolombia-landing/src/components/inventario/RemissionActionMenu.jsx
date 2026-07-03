import React, { useEffect, useId, useRef, useState } from "react";
import api from "../../lib/apiClient";
import InvIcon from "./InvIcon.jsx";
import { openRemissionPreview } from "../../lib/remissionPreview.js";

export default function RemissionActionMenu({ saleId, remissionNumber, onNotify }) {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const rootRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;

    const close = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!saleId || !remissionNumber) return null;

  const notify = (text, type = "success") => {
    onNotify?.(text, type);
  };

  const handlePreview = () => {
    openRemissionPreview(saleId);
    setOpen(false);
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await api.downloadAuthenticated(
        api.exportRemissionPdfUrl(saleId),
        `remision_${remissionNumber.replace(/\//g, "-")}.pdf`,
      );
      notify("Remisión descargada");
      setOpen(false);
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={`inv-action-menu${open ? " is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="inv-btn inv-btn--compact inv-btn--outline inv-action-menu__trigger"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
      >
        <InvIcon name="file-text" />
        Remisión
        <span className="inv-action-menu__chevron" aria-hidden="true" />
      </button>
      {open && (
        <div className="inv-action-menu__panel" id={menuId} role="menu">
          <button type="button" className="inv-action-menu__item" role="menuitem" onClick={handlePreview}>
            <InvIcon name="eye" />
            Vista previa
          </button>
          <button
            type="button"
            className="inv-action-menu__item"
            role="menuitem"
            onClick={handleDownload}
            disabled={downloading}
          >
            <InvIcon name="download" />
            {downloading ? "Descargando…" : "Descargar PDF"}
          </button>
        </div>
      )}
    </div>
  );
}
