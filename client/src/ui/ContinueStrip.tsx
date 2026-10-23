import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { DesignSummary } from "../types/api";
import { PlanThumb } from "./PlanThumb";
import { plural } from "@shared/lib/units";

export const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};
/** "Continue where you left off": the most recently edited design, if there is one. */
export function ContinueStrip({ designs: given }: { designs?: DesignSummary[] }) {
  const [fetched, setFetched] = useState<DesignSummary[] | null>(null),
    designs = given ?? fetched;
  useEffect(() => {
    if (!given) api<{ designs: DesignSummary[] }>("/designs").then((r) => setFetched(r.designs), () => setFetched([]));
  }, [given]);
  const last = designs?.[0];
  if (!last) return null;
  return (
    <Link className="continue-strip" to={`/editor/${last.id}`} data-testid="continue-strip">
      <PlanThumb width={last.plot.width} length={last.plot.length} rooms={last.outline} className="continue-thumb" />
      <span>
        <small>CONTINUE WHERE YOU LEFT OFF</small>
        <strong>{last.name}</strong>
        <em>
          {last.plot.width}×{last.plot.length} ft · {plural(last.rooms, "room")} · edited {ago(last.updatedAt)}
        </em>
      </span>
      <span className="continue-go">Open →</span>
    </Link>
  );
}
