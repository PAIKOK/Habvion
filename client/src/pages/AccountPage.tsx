import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { APP_NAME } from "@shared/version";
import { Header } from "../ui/Header";
import { SiteFooter } from "../ui/SiteFooter";
import { api } from "../api/client";
import { useAuthStore } from "../state/authStore";
import { PasswordInput } from "../ui/PasswordInput";

/** The person's own data: what we hold, a full download, and deletion that takes effect at once. */
export function AccountPage() {
  const user = useAuthStore((s) => s.user)!,
    nav = useNavigate(),
    [confirming, setConfirming] = useState(false),
    [secret, setSecret] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const before = document.title;
    document.title = `Your account · ${APP_NAME}`;
    return () => void (document.title = before);
  }, []);

  async function remove(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/auth/delete-account", { body: user.hasPassword ? { password: secret } : { confirm: secret.trim() } });
      useAuthStore.setState({ user: null });
      nav("/?deleted=1", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Your account could not be deleted. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Header />
      <main id="main" tabIndex={-1} className="account-page section-shell">
        <p className="eyebrow">YOUR ACCOUNT</p>
        <h1>Your account and data</h1>
        <section className="account-card">
          <h2>Details</h2>
          <dl className="account-details">
            <dt>Name</dt>
            <dd>{user.name}</dd>
            <dt>Email</dt>
            <dd>{user.email}</dd>
            <dt>Sign-in</dt>
            <dd>{[user.hasPassword && "Password", user.google && "Google"].filter(Boolean).join(" and ")}</dd>
          </dl>
          <p className="small-note">
            Your designs are listed under <Link to="/designs">My designs</Link>. See the <Link to="/privacy">Privacy Policy</Link> for how we use your data.
          </p>
        </section>

        <section className="account-card">
          <h2>Download your data</h2>
          <p>One JSON file with active account details, saved designs, linked messages and an owned-model file list. Model binaries, anonymous enquiries, backups and third-party copies are not all included.</p>
          <a className="button button-outline" href="/api/auth/export" download data-testid="export-data">
            Download my data (JSON)
          </a>
        </section>

        <section className="account-card account-danger">
          <h2>Delete your account</h2>
          <p>This deletes active account/design data, their share links, linked messages and generated files with recorded ownership. External copies, backups and older unowned files need separate review. Save anything you need first; this cannot be undone.</p>
          {!confirming ? (
            <button className="button button-danger-solid" onClick={() => setConfirming(true)}>
              Delete my account…
            </button>
          ) : (
            <form onSubmit={remove} aria-label="Confirm account deletion">
              <label className="field">
                <span>{user.hasPassword ? "Enter your password to confirm" : "Type DELETE to confirm"}</span>
                {user.hasPassword ? (
                  <PasswordInput autoComplete="current-password" value={secret} onChange={(e) => setSecret(e.target.value)} autoFocus />
                ) : (
                  <input type="text" autoComplete="off" value={secret} onChange={(e) => setSecret(e.target.value)} autoFocus />
                )}
              </label>
              {error && (
                <p className="error-text" role="alert">
                  {error}
                </p>
              )}
              <div className="account-actions">
                <button type="button" className="button button-outline" onClick={() => (setConfirming(false), setSecret(""), setError(""))}>
                  Keep my account
                </button>
                <button className="button button-danger-solid" disabled={busy || !secret}>
                  {busy ? "Deleting…" : "Delete everything"}
                </button>
              </div>
            </form>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
