import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "../ui/Header";
import { plural } from "@shared/lib/units";
import { api } from "../api/client";
import type { DesignSummary } from "../types/api";
import { PlanThumb } from "../ui/PlanThumb";
import { ContinueStrip, ago } from "../ui/ContinueStrip";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Skeleton } from "../ui/Skeleton";

export function DesignsPage() {
  const [designs, setDesigns] = useState<DesignSummary[] | null>(null),
    [error, setError] = useState(""),
    [pending, setPending] = useState<DesignSummary | null>(null),
    [deleting, setDeleting] = useState(false);
  useEffect(() => {
    api<{ designs: DesignSummary[] }>("/designs").then((r) => setDesigns(r.designs), (e: Error) => setError(e.message));
  }, []);
  async function remove(d: DesignSummary) {
    setDeleting(true);
    try {
      await api(`/designs/${d.id}`, { method: "DELETE" });
      setDesigns((all) => all?.filter((x) => x.id !== d.id) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete.");
    } finally {
      setDeleting(false);
      setPending(null);
    }
  }
  return (
    <>
      <Header />
      <main id="main" tabIndex={-1} className="section-shell designs-page">
        <div className="designs-head">
          <div>
            <p className="eyebrow">YOUR HOMES</p>
            <h1>My designs.</h1>
          </div>
          <Link className="button button-accent" to="/start">
            New design
          </Link>
        </div>
        {error && <p className="error-text" role="alert">{error}</p>}
        {!designs && !error && (
          <div className="designs-grid" role="status" aria-busy="true" aria-label="Loading your designs">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="design-card skeleton-card">
                <Skeleton height={150} radius={8} />
                <Skeleton width="70%" height={16} />
                <Skeleton width="50%" height={12} />
              </div>
            ))}
          </div>
        )}
        {designs && <ContinueStrip designs={designs} />}
        {designs && !designs.length && (
          <div className="designs-empty">
            <p>No designs yet. Start with your plot and every change saves itself.</p>
          </div>
        )}
        <div className="designs-grid">
          {designs?.map((d) => (
            <article key={d.id} className="design-card" data-testid="design-card">
              <Link to={`/editor/${d.id}`} className="design-card-link">
                <PlanThumb width={d.plot.width} length={d.plot.length} rooms={d.outline} />
                <h3>{d.name}</h3>
                <p>
                  {d.plot.width}×{d.plot.length} ft · {plural(d.floors, "floor")} · {plural(d.rooms, "room")}
                </p>
                <p className="muted small">
                  Edited {ago(d.updatedAt)}
                  {d.shared ? " · shared" : ""}
                </p>
              </Link>
              <button className="button-danger small-button" onClick={() => setPending(d)} aria-label={`Delete ${d.name}`} aria-haspopup="dialog">
                Delete
              </button>
            </article>
          ))}
        </div>
      </main>
      <ConfirmDialog
        open={!!pending}
        title={`Delete “${pending?.name ?? ""}”?`}
        confirmLabel="Delete design"
        cancelLabel="Keep it"
        danger
        busy={deleting}
        onConfirm={() => pending && void remove(pending)}
        onCancel={() => setPending(null)}
      >
        <p>This removes the design and turns off any share link to it. It cannot be undone.</p>
      </ConfirmDialog>
    </>
  );
}
