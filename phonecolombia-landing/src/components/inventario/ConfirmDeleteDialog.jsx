import React, { useEffect } from "react";

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 7h18v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
      <path d="M3 7l2-3h14l2 3M10 11h4" />
    </svg>
  );
}

/**
 * Diálogo de confirmación para eliminar/archivar dentro de modales del inventario.
 */
export default function ConfirmDeleteDialog({
  open,
  title,
  description,
  itemName,
  confirmLabel = "Eliminar",
  cancelLabel = "Cancelar",
  loading = false,
  tone = "danger",
  icon = "delete",
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape" && !loading) onCancel?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  const Icon = icon === "archive" ? ArchiveIcon : TrashIcon;

  return (
    <div
      className="inv-modal-overlay inv-modal-overlay--confirm"
      role="presentation"
      onClick={() => !loading && onCancel?.()}
    >
      <div
        className={`inv-modal inv-confirm-dialog inv-confirm-dialog--${tone}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="inv-confirm-delete-title"
        aria-describedby="inv-confirm-delete-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="inv-confirm-dialog__icon" aria-hidden="true">
          <Icon />
        </div>
        <h3 id="inv-confirm-delete-title" className="inv-confirm-dialog__title">
          {title}
        </h3>
        <p id="inv-confirm-delete-desc" className="inv-confirm-dialog__text">
          {description ?? (
            <>
              Se eliminará <strong>{itemName}</strong>. Esta acción no se puede deshacer.
            </>
          )}
        </p>
        <div className="inv-modal__actions inv-confirm-dialog__actions">
          <button
            type="button"
            className="inv-btn inv-btn--outline"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="inv-btn inv-btn--danger"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Procesando…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
