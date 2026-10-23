import type { HomeDesign, Door, Opening } from "@shared/types/home";
import { deriveWalls, openingsOn, openingLine, sideNormal } from "@shared/design/walls";
import { DOOR_TYPES } from "@shared/design/openingTypes";
import { EPS } from "@shared/lib/geometry";
import { useEditorStore } from "../state/editorStore";
export function WallLayer({
  design,
  floor,
  readOnly = false,
}: {
  design: HomeDesign;
  floor: number;
  readOnly?: boolean;
}) {
  const ui = useEditorStore();
  const opening = (o: Opening) => {
    const p = openingLine(design, o)!;
    return (
      <g
        key={o.id}
        data-opening-id={o.id}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (!readOnly) ui.set({ selected: o.id, tool: "select", panel: "inspector" });
        }}
        style={{ cursor: "pointer" }}
      >
        {"doorType" in o ? (
          <DoorShape design={design} door={o as Door} />
        ) : (
          <>
            <path
              d={p.horizontal ? `M${p.start} ${p.line}H${p.end}` : `M${p.line} ${p.start}V${p.end}`}
              stroke="#f6fbfc"
              strokeWidth=".65"
            />
            <path
              d={p.horizontal ? `M${p.start} ${p.line}H${p.end}` : `M${p.line} ${p.start}V${p.end}`}
              stroke="#7fadb9"
              strokeWidth=".2"
            />
            <path
              d={
                p.horizontal
                  ? `M${p.start} ${p.line - 0.2}H${p.end}M${p.start} ${p.line + 0.2}H${p.end}`
                  : `M${p.line - 0.2} ${p.start}V${p.end}M${p.line + 0.2} ${p.start}V${p.end}`
              }
              stroke="#80a5ae"
              strokeWidth=".05"
            />
          </>
        )}
        {ui.selected === o.id && (
          <circle
            cx={p.center.x}
            cy={p.center.y}
            r={0.4}
            fill="none"
            stroke="#b65036"
            strokeWidth=".08"
          />
        )}
      </g>
    );
  };
  return (
    <g>
      <g pointerEvents="none">
        {deriveWalls(design)
          .filter((w) => w.floor === floor)
          .map((w) => {
            const horizontal = Math.abs(w.a.y - w.b.y) < EPS,
              start = horizontal ? w.a.x : w.a.y,
              end = horizontal ? w.b.x : w.b.y,
              spans = openingsOn(design, w)
                .map((o) => openingLine(design, o)!)
                .map((p) => [Math.max(start, p.start), Math.min(end, p.end)])
                .sort((a, b) => a[0]! - b[0]!);
            let cursor = start;
            const parts: number[][] = [];
            for (const [a, b] of spans) {
              if (a! > cursor) parts.push([cursor, a!]);
              cursor = Math.max(cursor, b!);
            }
            if (cursor < end) parts.push([cursor, end]);
            return (
              <g key={w.id} data-derived-wall={w.id}>
                {parts.map(([a, b], i) => (
                  <path
                    key={i}
                    d={horizontal ? `M${a} ${w.a.y}H${b}` : `M${w.a.x} ${a}V${b}`}
                    stroke={w.open ? "#8d9a78" : "#5c5c50"}
                    strokeWidth={w.thickness}
                    strokeLinecap="butt"
                  />
                ))}
              </g>
            );
          })}
      </g>
      {[...design.doors, ...design.windows]
        .filter((o) => design.rooms.find((r) => r.id === o.roomId)?.floor === floor)
        .map(opening)}
    </g>
  );
}
function DoorShape({ design, door }: { design: HomeDesign; door: Door }) {
  const p = openingLine(design, door)!,
    n = sideNormal(door.side),
    right = door.swing === "right",
    hinge = p.horizontal
      ? { x: right ? p.end : p.start, y: p.line }
      : { x: p.line, y: right ? p.end : p.start },
    tip = p.horizontal
      ? { x: right ? p.start : p.end, y: p.line }
      : { x: p.line, y: right ? p.start : p.end },
    end = { x: hinge.x + n.x * door.width, y: hinge.y + n.y * door.width },
    cross = (tip.x - hinge.x) * (end.y - hinge.y) - (tip.y - hinge.y) * (end.x - hinge.x);
  return (
    <>
      <path
        d={p.horizontal ? `M${p.start} ${p.line}H${p.end}` : `M${p.line} ${p.start}V${p.end}`}
        stroke="#fbf9f5"
        strokeWidth=".65"
      />
      {DOOR_TYPES[door.doorType].swings ? (
        <>
          <path d={`M${hinge.x} ${hinge.y}L${end.x} ${end.y}`} stroke="#a17b5d" strokeWidth=".12" />
          <path
            data-door-swing={door.id}
            d={`M${tip.x} ${tip.y}A${door.width} ${door.width} 0 0 ${cross > 0 ? 1 : 0} ${end.x} ${end.y}`}
            stroke="#b39374"
            fill="none"
            strokeWidth=".06"
          />
        </>
      ) : (
        <path
          d={p.horizontal ? `M${p.start} ${p.line}H${p.end}` : `M${p.line} ${p.start}V${p.end}`}
          stroke="#a17b5d"
          strokeWidth=".12"
          strokeDasharray=".5 .12"
        />
      )}
    </>
  );
}
