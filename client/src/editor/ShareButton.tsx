import { useState } from "react";
import { CopyButton } from "../ui/CopyButton";
import { api } from "../api/client";

/** Turn a public read-only link on or off. The token is unguessable and revocable. */
export function ShareButton({ designId }: { designId: string }) {
  const [open, setOpen] = useState(false),
    [token, setToken] = useState<string | null>(null),
    [error, setError] = useState(""),
    link = token ? `${location.origin}/shared/${token}` : "";
  async function share() {
    setOpen(true);
    setError("");
    try {
      setToken((await api<{ token: string }>(`/designs/${designId}/share`, { body: {} })).token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create a link.");
    }
  }
  async function stop() {
    try {
      await api(`/designs/${designId}/share`, { method: "DELETE" });
      setToken(null);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not turn sharing off.");
    }
  }
  return (
    <div className="share">
      <button className="small-button" onClick={() => (open ? setOpen(false) : void share())} aria-expanded={open}>
        Share
      </button>
      {open && (
        <div className="share-pop" role="dialog" aria-label="Share this design">
          <p>Anyone with this link can view the design. They cannot change it.</p>
          {token && (
            <div className="share-row">
              <input aria-label="Share link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
              <CopyButton text={link} label="Copy link" />
            </div>
          )}
          {error && <p className="error-text">{error}</p>}
          {token && (
            <button className="button-danger small-button" onClick={stop}>
              Stop sharing
            </button>
          )}
        </div>
      )}
    </div>
  );
}
