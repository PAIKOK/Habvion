import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { HomeDesign } from "@shared/types/home";
import { newId } from "@shared/design/createDesign";
import { api } from "../api/client";
import { useAuthStore } from "../state/authStore";
import { useDesignStore } from "../state/designStore";
import { Header } from "../ui/Header";
import { DesignViewer } from "../ui/DesignViewer";

/** `/demos/:id`: a public look at a demo house, and a way to make it your own. */
export function DemoPage() {
  const { id = "" } = useParams(),
    [params] = useSearchParams(),
    nav = useNavigate(),
    { user, status } = useAuthStore(),
    dispatch = useDesignStore((s) => s.dispatch),
    [design, setDesign] = useState<HomeDesign | null>(null),
    [loadError, setLoadError] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    started = useRef(false);
  // The server builds each demo once; the browser only receives the finished design.
  useEffect(() => {
    const ctl = new AbortController();
    setDesign(null);
    setLoadError("");
    api<{ design: HomeDesign }>(`/demos/${encodeURIComponent(id)}`, { signal: ctl.signal })
      .then((r) => setDesign(r.design))
      .catch((e: Error) => !ctl.signal.aborted && setLoadError(e.message));
    return () => ctl.abort();
  }, [id]);
  async function customize() {
    if (!design) return;
    if (!user) return nav(`/signup?next=${encodeURIComponent(`/demos/${id}?customize=1`)}`);
    setBusy(true);
    setError("");
    try {
      const now = new Date().toISOString(),
        copy = { ...design, id: newId("design"), name: `My ${design.name}`, createdAt: now, updatedAt: now, revision: 0 };
      await api("/designs", { body: { design: copy } });
      dispatch({ type: "design/load", design: copy });
      nav(`/editor/${copy.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not copy the house.");
      setBusy(false);
    }
  }
  // ?customize=1 (from a landing card, or back from sign-in): finish it once.
  useEffect(() => {
    if (params.get("customize") === "1" && status === "ready" && design && !started.current) {
      started.current = true;
      void customize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, status, user, design]);
  if (loadError)
    return (
      <>
        <Header />
        <main id="main" tabIndex={-1} className="section-shell placeholder-page">
          <h1>{loadError.startsWith("There is no demo") ? "Demo not found." : "This demo did not load."}</h1>
          <p>{loadError}</p>
          <Link to="/#demo-homes">See the demo homes</Link>
        </main>
      </>
    );
  if (!design)
    return (
      <>
        <Header />
        <main id="main" tabIndex={-1} className="section-shell placeholder-page" aria-busy="true">
          <p>Loading the demo home…</p>
        </main>
      </>
    );
  return (
    <div className="viewer-page">
      <Header />
      <DesignViewer
        design={design}
        badge="DEMO HOME · READ-ONLY"
        actions={
          <>
            {error && <span className="error-text small">{error}</span>}
            <button className="button button-accent viewer-cta" onClick={customize} disabled={busy}>
              {busy ? "Copying…" : "Customize This House"}
            </button>
          </>
        }
      />
    </div>
  );
}
