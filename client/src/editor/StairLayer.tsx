import type { PointerEvent as ReactPointerEvent } from "react";
import type { HomeDesign, Stair } from "@shared/types/home";
import { arrivalsOf, stairParts, stairWell } from "@shared/design/stairs";
import { useEditorStore } from "../state/editorStore";

const path = (pts: { x: number; y: number }[]) =>
  "M" + pts.map((p) => `${p.x} ${p.y}`).join("L") + "Z";
const centroid = (pts: { x: number; y: number }[]) => ({
  x: pts.reduce((n, p) => n + p.x, 0) / pts.length,
  y: pts.reduce((n, p) => n + p.y, 0) / pts.length,
});

/** Stairs climbing from this floor, and wells of stairs arriving on it. */
export function StairLayer({
  design,
  floor,
  onStairDown,
}: {
  design: HomeDesign;
  floor: number;
  onStairDown?: (e: ReactPointerEvent<SVGElement>, s: Stair) => void;
}) {
  const ui = useEditorStore();
  return (
    <g>
      {design.stairs
        .filter((s) => s.toFloor === floor)
        .map((s) => {
          const well = stairWell(design, s);
          return (
            <g key={`well-${s.id}`} data-stair-well={s.id} pointerEvents="none">
              {well && (
                <>
                  <rect
                    x={well.x}
                    y={well.y}
                    width={well.width}
                    height={well.length}
                    fill="url(#well-hatch)"
                    stroke="#6b6458"
                    strokeWidth=".1"
                    strokeDasharray=".4 .2"
                  />
                  <text
                    x={well.x + well.width / 2}
                    y={well.y + well.length / 2}
                    fontSize=".7"
                    textAnchor="middle"
                    fill="#6b6458"
                  >
                    DN · open to below
                  </text>
                </>
              )}
              {arrivalsOf(design, s).map((a, i) => (
                <rect
                  key={i}
                  data-stair-arrival={s.id}
                  x={a.x}
                  y={a.y}
                  width={a.width}
                  height={a.length}
                  fill="#b6503612"
                  stroke="#b65036"
                  strokeWidth=".06"
                  strokeDasharray=".25 .15"
                />
              ))}
            </g>
          );
        })}
      {design.stairs
        .filter((s) => s.fromFloor === floor)
        .map((s) => {
          const parts = stairParts(design, s),
            line = parts.filter((p) => !(s.stairType === "bifurcated" && p.flight === 3)),
            selected = ui.selected === s.id,
            arrow = line.map((p) => centroid(p.pts));
          return (
            <g
              key={s.id}
              data-stair-id={s.id}
              onPointerDown={(e) => onStairDown?.(e, s)}
              style={{ cursor: "pointer" }}
            >
              <rect
                x={s.x}
                y={s.y}
                width={s.width}
                height={s.length}
                fill="#f7f3ec"
                stroke={selected ? "#b65036" : "#6b6458"}
                strokeWidth={selected ? ".2" : ".08"}
              />
              {parts.map((p, i) => (
                <path
                  key={i}
                  d={path(p.pts)}
                  fill={p.kind === "landing" ? "#ebe4d8" : "#fbf8f2"}
                  stroke="#8b8273"
                  strokeWidth=".05"
                  pointerEvents="none"
                />
              ))}
              {arrow.length > 1 && (
                <g pointerEvents="none">
                  <path
                    d={"M" + arrow.map((p) => `${p.x} ${p.y}`).join("L")}
                    fill="none"
                    stroke="#b65036"
                    strokeWidth=".08"
                  />
                  <circle cx={arrow[0]!.x} cy={arrow[0]!.y} r=".18" fill="#b65036" />
                  <text
                    x={arrow[0]!.x}
                    y={arrow[0]!.y + 0.75}
                    fontSize=".55"
                    textAnchor="middle"
                    fill="#b65036"
                  >
                    UP
                  </text>
                </g>
              )}
            </g>
          );
        })}
    </g>
  );
}
