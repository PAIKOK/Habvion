import { lazy, Suspense, useEffect, useMemo } from "react";
import type { HomeDesign } from "@shared/types/home";
import { floorLabel, inr, plural } from "@shared/lib/units";
import { estimateBudget } from "@shared/design/budget";
import { PlanCanvas } from "../editor/PlanCanvas";
import { useEditorStore } from "../state/editorStore";

const Scene3D = lazy(() => import("../three/Scene3D").then((m) => ({ default: m.Scene3D })));

/** A public, read-only look at a design: plan per floor, the 3D model, the estimate. */
export function DesignViewer({ design, badge, actions }: { design: HomeDesign; badge: string; actions?: React.ReactNode }) {
  const ui = useEditorStore(),
    budget = useMemo(() => estimateBudget(design), [design]);
  useEffect(() => {
    ui.set({ floor: 0, selected: null, tool: "select", view: "2d", paletteId: null });
    // Reset once per design; ui.set is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design.id]);
  return (
    <main id="main" tabIndex={-1} className="viewer" data-testid="viewer">
      <div className="viewer-bar">
        <div>
          <span className="viewer-badge">{badge}</span>
          <h1>{design.name}</h1>
          <p>
            {design.plot.width}×{design.plot.length} ft plot · {plural(design.floors.length, "floor")} ·{" "}
            {plural(design.rooms.filter((r) => !["garden", "parking", "porch", "courtyard", "balcony", "terrace"].includes(r.type)).length, "room")} · estimate{" "}
            <strong>{inr(budget.total)}</strong>
          </p>
        </div>
        <div className="viewer-controls">
          <div className="tool-group" role="group" aria-label="View">
            {(["2d", "3d"] as const).map((v) => (
              <button key={v} aria-pressed={ui.view === v} className={ui.view === v ? "active" : ""} onClick={() => ui.set({ view: v })}>
                {v.toUpperCase()}
              </button>
            ))}
          </div>
          {ui.view === "2d" && (
            <div className="floor-tabs" role="tablist" aria-label="Floors">
              {design.floors.map((f) => (
                <button key={f.level} role="tab" aria-selected={ui.floor === f.level} className={ui.floor === f.level ? "active" : ""} onClick={() => ui.set({ floor: f.level })}>
                  {f.level === 0 ? "Ground" : floorLabel(f.level).replace(" floor", "")}
                </button>
              ))}
            </div>
          )}
          {actions}
        </div>
      </div>
      <div className="viewer-stage">
        {ui.view === "3d" ? (
          <Suspense fallback={<div className="scene-loading">Loading 3D…</div>}>
            <Scene3D design={design} />
          </Suspense>
        ) : (
          <PlanCanvas design={design} readOnly />
        )}
      </div>
    </main>
  );
}
