import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { create } from "zustand";

const KEY = "hb-consent";
type Saved = { v: 1; google: boolean; at: string };
function load(): Saved | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as Saved | null;
    const at = s && typeof s.at === "string" ? Date.parse(s.at) : NaN;
    return s && s.v === 1 && typeof s.google === "boolean" && Number.isFinite(at) && at <= Date.now() && Date.now()-at < 180*86_400_000 ? s : null;
  } catch {
    return null;
  }
}

/** The visitor's choice about optional third-party storage. Essential storage needs no consent. */
export const useConsent = create<{ decided: boolean; google: boolean; open: boolean }>(() => {
  const s = load();
  return { decided: !!s, google: !!s?.google, open: false };
});
export function setConsent(google: boolean) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, google, at: new Date().toISOString() } satisfies Saved));
  } catch {}
  useConsent.setState({ decided: true, google, open: false });
}
export const openCookieSettings = () => useConsent.setState({ open: true });

/**
 * Asks once, with "Accept all" and "Essential only" given equal weight, and can be
 * reopened from the footer at any time. Nothing optional loads before a choice.
 */
export function CookieBanner() {
  const { decided, google, open } = useConsent(),
    [allowGoogle, setAllowGoogle] = useState(google),
    first = useRef<HTMLButtonElement>(null);
  const show = !decided || open;
  useEffect(() => {
    if (open) {
      const previous = document.activeElement as HTMLElement | null;
      setAllowGoogle(google);
      first.current?.focus();
      first.current?.scrollIntoView({ block: "nearest" });
      return () => { if (previous?.isConnected) previous.focus(); };
    }
  }, [open, google]);
  if (!show) return null;
  return (
    <section className="cookie-banner" role="region" aria-label="Cookie choices" data-testid="cookie-banner" onKeyDown={(e) => e.key === "Escape" && open && useConsent.setState({ open: false })}>
      <div className="cookie-text">
        <strong>Your privacy</strong>
        <p>
          We use one cookie to keep you signed in, and nothing for ads or tracking. Google's sign-in script is optional and only loads if you allow it. <Link to="/cookies">Cookie Policy</Link>
        </p>
        {open && (
          <label className="check-field cookie-toggle">
            <input type="checkbox" checked={allowGoogle} onChange={(e) => setAllowGoogle(e.target.checked)} /> Allow Google Sign-In
          </label>
        )}
      </div>
      <div className="cookie-actions">
        {open ? (
          <button ref={first} className="button button-outline" onClick={() => setConsent(allowGoogle)}>
            Save choices
          </button>
        ) : (
          <>
            <button ref={first} className="button button-outline" onClick={() => setConsent(false)}>
              Essential only
            </button>
            <button className="button button-outline" onClick={() => setConsent(true)}>
              Accept all
            </button>
          </>
        )}
      </div>
    </section>
  );
}
