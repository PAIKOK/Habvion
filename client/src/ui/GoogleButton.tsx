import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../state/authStore";
import { setConsent, useConsent } from "./CookieBanner";

type Gsi = {
  accounts: {
    id: {
      initialize(o: { client_id: string; callback: (r: { credential: string }) => void }): void;
      renderButton(el: HTMLElement, o: Record<string, unknown>): void;
    };
  };
};
let loading: Promise<Gsi> | null = null;
function loadGsi(): Promise<Gsi> {
  const w = window as unknown as { google?: Gsi };
  if (w.google?.accounts) return Promise.resolve(w.google);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => (w.google ? resolve(w.google) : reject(new Error("Google script loaded without its API")));
    s.onerror = () => {
      loading = null;
      reject(new Error("Could not load Google sign-in"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * Google Identity Services button. The ID token it yields is verified on the server.
 * Google's script is third-party, so it loads only once the visitor has allowed it,
 * either in the cookie banner or by clicking this button. `locked` holds it back until
 * the sign-up consent box is ticked; `consent` is sent so a new account records it.
 */
export function GoogleButton({ onSignedIn, onError, locked, consent }: { onSignedIn: () => void; onError: (m: string) => void; locked?: string; consent?: boolean }) {
  const clientId = useAuthStore((s) => s.googleClientId),
    google = useAuthStore((s) => s.google),
    allowed = useConsent((s) => s.google),
    slot = useRef<HTMLDivElement>(null),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!clientId || !allowed || locked || !slot.current) return;
    let live = true;
    loadGsi()
      .then((g) => {
        if (!live || !slot.current) return;
        g.accounts.id.initialize({
          client_id: clientId,
          callback: ({ credential }) =>
            google(credential, consent).then(onSignedIn, (e: unknown) => onError(e instanceof Error ? e.message : "Google sign-in failed.")),
        });
        g.accounts.id.renderButton(slot.current, { theme: "outline", size: "large", width: 320, text: "continue_with" });
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [clientId, allowed, locked, consent, google, onSignedIn, onError]);
  if (!clientId || failed)
    return (
      <button type="button" className="google-unavailable" disabled title="Google sign-in is not configured on this server">
        Continue with Google — {failed ? "could not load" : "not available"}
      </button>
    );
  if (locked)
    return (
      <button type="button" className="google-consent" disabled data-testid="google-locked">
        Continue with Google <small>{locked}</small>
      </button>
    );
  if (!allowed)
    return (
      <button type="button" className="google-consent" data-testid="google-consent" onClick={() => setConsent(true)}>
        Continue with Google <small>Loads Google's sign-in · see Cookie Policy</small>
      </button>
    );
  return <div ref={slot} className="google-slot" data-testid="google-button" />;
}
