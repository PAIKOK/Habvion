import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * A confirmation step for actions that cannot be undone or lose work.
 * Built on the native <dialog>, so focus stays inside it, Escape cancels, and the
 * page behind is inert. Focus starts on the safe choice, never on the destructive one.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const id = useId(),
    ref = useRef<HTMLDialogElement>(null),
    cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      cancel.current?.focus();
    } else if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={children ? `${id}-body` : undefined}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      onClick={(e) => {
        // A click on the backdrop (the dialog element itself, outside its box) cancels.
        if (e.target === ref.current && !busy) onCancel();
      }}
    >
      <div className="confirm-box">
        <h2 id={`${id}-title`}>{title}</h2>
        {children && <div id={`${id}-body`}>{children}</div>}
        <div className="confirm-actions">
          <button ref={cancel} type="button" className="button button-outline" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button type="button" className={`button ${danger ? "button-danger-solid" : "button-accent"}`} onClick={onConfirm} disabled={busy}>
            {busy ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
