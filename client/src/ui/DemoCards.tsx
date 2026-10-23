import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { DemoCard } from "../types/api";
import { indianGroup, inr, plural } from "@shared/lib/units";
import { PlanThumb } from "./PlanThumb";

/** The landing page's demo houses: a live plan and facts counted from each design. */
export function DemoCards() {
  const [demos, setDemos] = useState<DemoCard[] | null>(null),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const ctl = new AbortController();
    setError("");
    api<{ demos: DemoCard[] }>("/demos", { signal: ctl.signal })
      .then((r) => setDemos(r.demos))
      .catch((e: Error) => !ctl.signal.aborted && setError(e.message));
    return () => ctl.abort();
  }, [attempt]);
  if (error)
    return (
      <div className="empty-demos" role="alert">
        <h3>The demo homes did not load.</h3>
        <p>{error}</p>
        <button className="text-link" onClick={() => setAttempt((n) => n + 1)}>
          Try again
        </button>
      </div>
    );
  if (!demos)
    return (
      <div className="demo-grid" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="demo-card demo-card-loading" />
        ))}
      </div>
    );
  return (
    <div className="demo-grid">
      {demos.map((d) => {
        const f = d.facts;
        return (
          <article key={d.id} className="demo-card" data-testid="demo-card">
            <Link to={`/demos/${d.id}`} className="demo-card-plan" aria-label={`View ${d.title}`}>
              <PlanThumb width={f.plot.width} length={f.plot.length} rooms={f.outline} className="demo-thumb" />
            </Link>
            <div className="demo-card-body">
              <h3>{d.title}</h3>
              <p className="demo-tagline">{d.tagline}</p>
              <dl className="demo-facts">
                <div><dt>Plot</dt><dd>{f.plot.width}×{f.plot.length} ft</dd></div>
                <div><dt>Built-up</dt><dd>{indianGroup(f.builtUpArea)} sq ft</dd></div>
                <div><dt>Floors</dt><dd>{f.floors}</dd></div>
                <div><dt>Bedrooms</dt><dd>{f.bedrooms}</dd></div>
                <div><dt>Bathrooms</dt><dd>{f.bathrooms}{f.powderRooms ? ` + ${plural(f.powderRooms, "powder", "powder")}` : ""}</dd></div>
                <div><dt>Parking</dt><dd>{f.parking}</dd></div>
              </dl>
              <p className="demo-estimate">
                Estimate <strong>{inr(f.estimate)}</strong>
              </p>
              <div className="demo-actions">
                <Link className="button button-outline" to={`/demos/${d.id}`}>
                  View House
                </Link>
                <Link className="button button-accent" to={`/demos/${d.id}?customize=1`}>
                  Customize This House
                </Link>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
