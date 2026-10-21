import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

// Accessible dialog rendered over the page: Esc or the backdrop closes it,
// focus moves into it and returns to the opener, and the page behind stops scrolling.
export default function Modal({
  title,
  onClose,
  actions,
  wide = false,
  children,
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    document.body.classList.add("modal-open");
    dialogRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("modal-open");
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        className={`modal ${wide ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
      >
        <header className="modal-head no-print">
          <h2 id="modal-title">{title}</h2>
          <div className="modal-actions">
            {actions}
            <button
              type="button"
              className="icon-btn modal-close"
              aria-label="Close"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
