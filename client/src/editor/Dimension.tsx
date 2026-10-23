import { lengthLabel } from "@shared/lib/units";
import type { Unit } from "@shared/types/home";
export function Dimension({
  x,
  y,
  length,
  vertical = false,
  unit,
}: {
  x: number;
  y: number;
  length: number;
  vertical?: boolean;
  unit: Unit;
}) {
  return (
    <g
      data-dimension="true"
      transform={`translate(${x},${y}) ${vertical ? "rotate(-90)" : ""}`}
      style={{ pointerEvents: "none" }}
    >
      <path
        d={`M0-.4v.8m${length}-.8v.8M0 0h${length}`}
        fill="none"
        stroke="var(--muted)"
        strokeWidth=".06"
      />
      <text
        x={length / 2}
        y={-0.35}
        fontSize=".72"
        textAnchor="middle"
        fill="var(--text)"
        paintOrder="stroke"
        stroke="var(--panel)"
        strokeWidth=".2"
      >
        {lengthLabel(length, unit)}
      </text>
    </g>
  );
}
