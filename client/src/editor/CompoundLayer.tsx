import type { HomeDesign } from "@shared/types/home";
import { compoundSegments } from "@shared/design/finishes";

export function CompoundLayer({ design }: { design: HomeDesign }) {
  const c = design.compound;
  if (!c) return null;
  return (
    <g pointerEvents="none" data-compound="true">
      {compoundSegments(design.plot, c).map(([a, b], i) => (
        <path
          key={i}
          d={`M${a.x} ${a.y}L${b.x} ${b.y}`}
          stroke="#8a7f6c"
          strokeWidth={c.thickness}
          strokeLinecap="butt"
        />
      ))}
      {[c.gate, ...(c.pedestrianGate ? [c.pedestrianGate] : [])].map((g) => {
        const h = g.side === "north" || g.side === "south",
          line =
            g.side === "north"
              ? 0
              : g.side === "south"
                ? design.plot.length
                : g.side === "west"
                  ? 0
                  : design.plot.width,
          s = g.offset - g.width / 2,
          e = g.offset + g.width / 2;
        return (
          <g key={g.kind}>
            <path
              data-gate={g.kind}
              d={h ? `M${s} ${line}H${e}` : `M${line} ${s}V${e}`}
              stroke="#b65036"
              strokeWidth=".12"
              strokeDasharray={g.kind === "sliding" ? ".4 .15" : undefined}
            />
            <text
              x={h ? g.offset : line + (g.side === "west" ? 1.2 : -1.2)}
              y={h ? line + (g.side === "north" ? -0.6 : 1.3) : g.offset}
              fontSize=".6"
              textAnchor="middle"
              fill="#b65036"
            >
              {g.kind === "pedestrian" ? "WICKET" : "GATE"}
            </text>
          </g>
        );
      })}
    </g>
  );
}
