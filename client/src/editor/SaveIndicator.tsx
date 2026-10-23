import { useSaveStore } from "../state/autosave";

export function SaveIndicator() {
  const { status, message } = useSaveStore();
  const label = { saved: "All changes saved", pending: "Unsaved changes…", saving: "Saving…", error: "Not saved — retrying" }[status];
  return (
    <span className={`save-indicator save-${status}`} data-testid="save-status" data-status={status} title={message || label} role="status">
      <span className="save-dot" aria-hidden />
      {label}
    </span>
  );
}
