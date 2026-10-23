import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useDesignStore } from "../state/designStore";
import { useEditorStore } from "../state/editorStore";
import { ROOM_INFO, roomName } from "@shared/design/roomTypes";
import { newId } from "@shared/design/createDesign";
import { snapPoint } from "@shared/design/placement";
import { areaLabel } from "@shared/lib/units";
import type { HomeDesign, PlacedFurniture, Point, Room, Stair } from "@shared/types/home";
import { FurnitureLayer } from "./FurnitureLayer";
import { itemFor } from "@shared/design/catalog";
import { ROTATION_FOR_WALL, findFurnitureSpot, validateFurniture } from "@shared/design/furniture";
import { STAIR_TYPES } from "@shared/design/stairs";
import { buildableRect } from "@shared/lib/geometry";
import { StairLayer } from "./StairLayer";
import { CompoundLayer } from "./CompoundLayer";
import { WallLayer } from "./WallLayer";
import { Dimension } from "./Dimension";
type View = { x: number; y: number; w: number; h: number };
type Drag = {
  kind: "draw" | "move" | "resize" | "pan" | "stair" | "piece";
  start: Point;
  piece?: PlacedFurniture;
  room?: Room;
  stair?: Stair;
  handle?: string;
  view?: View;
};
export function PlanCanvas({
  design,
  readOnly = false,
}: {
  design: HomeDesign;
  readOnly?: boolean;
}) {
  const dispatch = useDesignStore((s) => s.dispatch),
    ui = useEditorStore(),
    svg = useRef<SVGSVGElement>(null),
    drag = useRef<Drag | null>(null);
  const [view, setView] = useState<View>({
      x: -5,
      y: -7,
      w: design.plot.width + 10,
      h: design.plot.length + 14,
    }),
    [preview, setPreview] = useState<Room | null>(null),
    [stairPreview, setStairPreview] = useState<Stair | null>(null),
    [piecePreview, setPiecePreview] = useState<PlacedFurniture | null>(null),
    [measure, setMeasure] = useState<Point[]>([]);
  useEffect(
    () => setView({ x: -5, y: -7, w: design.plot.width + 10, h: design.plot.length + 14 }),
    [design.id, design.plot.width, design.plot.length],
  );
  const rooms = design.rooms.filter((r) => r.floor === ui.floor),
    selected = rooms.find((r) => r.id === ui.selected);
  const point = (e: { clientX: number; clientY: number }): Point => {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
    return { x: p.x, y: p.y };
  };
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = point(e),
        factor = e.deltaY > 0 ? 1.12 : 0.89;
      setView((v) => {
        const w = Math.min(design.plot.width * 4, Math.max(8, v.w * factor)),
          f = w / v.w;
        return { x: p.x - (p.x - v.x) * f, y: p.y - (p.y - v.y) * f, w, h: v.h * f };
      });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [design.plot.width]);
  const start = (
    e: ReactPointerEvent<SVGElement>,
    kind: Drag["kind"],
    room?: Room,
    handle?: string,
  ) => {
    if (readOnly && kind !== "pan") return;
    e.stopPropagation();
    svg.current?.setPointerCapture(e.pointerId);
    const p = point(e);
    drag.current = {
      kind,
      start: kind === "draw" ? snapPoint(p, rooms, ui.snap && !e.altKey) : p,
      room,
      handle,
      view,
    };
    if (room) ui.set({ selected: room.id, panel: "inspector" });
  };
  function move(e: ReactPointerEvent<SVGSVGElement>) {
    const d = drag.current;
    if (!d) return;
    const p = point(e);
    if (d.kind === "pan") {
      const v = d.view!;
      setView({ ...v, x: view.x + d.start.x - p.x, y: view.y + d.start.y - p.y });
      return;
    }
    if (d.kind === "piece") {
      const f = d.piece!,
        snap = (v: number) => (ui.snap && !e.altKey ? Math.round(v * 4) / 4 : v);
      setPiecePreview({
        ...f,
        x: snap(f.x + p.x - d.start.x),
        y: snap(f.y + p.y - d.start.y),
      });
      return;
    }
    if (d.kind === "stair") {
      const s = d.stair!,
        q = snapPoint(
          { x: s.x + p.x - d.start.x, y: s.y + p.y - d.start.y },
          rooms,
          ui.snap && !e.altKey,
        );
      setStairPreview({ ...s, x: q.x, y: q.y });
      return;
    }
    if (d.kind === "draw") {
      const q = snapPoint(p, rooms, ui.snap && !e.altKey);
      setPreview({
        id: "preview",
        name: ROOM_INFO[ui.roomType].label,
        type: ui.roomType,
        x: Math.max(0, Math.min(d.start.x, q.x)),
        y: Math.max(0, Math.min(d.start.y, q.y)),
        width: Math.abs(q.x - d.start.x),
        length: Math.abs(q.y - d.start.y),
        floor: ui.floor,
      });
      return;
    }
    const r = d.room!,
      delta = { x: p.x - d.start.x, y: p.y - d.start.y };
    if (d.kind === "move") {
      const q = snapPoint(
        { x: r.x + delta.x, y: r.y + delta.y },
        rooms.filter((x) => x.id !== r.id),
        ui.snap && !e.altKey,
      );
      setPreview({ ...r, x: Math.max(0, q.x), y: Math.max(0, q.y) });
      return;
    }
    let x = r.x,
      y = r.y,
      width = r.width,
      length = r.length;
    const q = snapPoint(
      { x: p.x, y: p.y },
      rooms.filter((x) => x.id !== r.id),
      ui.snap && !e.altKey,
    );
    if (d.handle!.includes("e")) width = Math.max(0.5, q.x - r.x);
    if (d.handle!.includes("s")) length = Math.max(0.5, q.y - r.y);
    if (d.handle!.includes("w")) {
      x = Math.min(q.x, r.x + r.width - 0.5);
      width = r.x + r.width - x;
    }
    if (d.handle!.includes("n")) {
      y = Math.min(q.y, r.y + r.length - 0.5);
      length = r.y + r.length - y;
    }
    setPreview({ ...r, x, y, width, length });
  }
  function finish(e: ReactPointerEvent<SVGSVGElement>) {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    svg.current?.releasePointerCapture(e.pointerId);
    if (d.kind === "piece") {
      const f = d.piece!;
      if (piecePreview && (piecePreview.x !== f.x || piecePreview.y !== f.y)) {
        // A piece dragged into another room changes rooms.
        const target =
          rooms.find(
            (r) =>
              piecePreview.x > r.x &&
              piecePreview.x < r.x + r.width &&
              piecePreview.y > r.y &&
              piecePreview.y < r.y + r.length,
          ) ?? rooms.find((r) => r.id === f.roomId);
        dispatch({
          type: "furniture/update",
          id: f.id,
          patch: { x: piecePreview.x, y: piecePreview.y, roomId: target?.id ?? f.roomId },
        });
      }
      setPiecePreview(null);
      return;
    }
    if (d.kind === "stair") {
      if (stairPreview && (stairPreview.x !== d.stair!.x || stairPreview.y !== d.stair!.y))
        dispatch({
          type: "stair/update",
          id: d.stair!.id,
          patch: { x: stairPreview.x, y: stairPreview.y },
        });
      setStairPreview(null);
      return;
    }
    if (d.kind === "draw") {
      const r = preview ?? {
        id: "preview",
        name: "",
        type: ui.roomType,
        x: d.start.x,
        y: d.start.y,
        width: ROOM_INFO[ui.roomType].width,
        length: ROOM_INFO[ui.roomType].length,
        floor: ui.floor,
      };
      const room = {
        ...r,
        id: newId("room"),
        name: roomName(
          ui.roomType,
          design.rooms.map((r) => r.name),
        ),
      };
      const result = dispatch({ type: "room/add", room });
      if (result?.applied) ui.set({ tool: "select", selected: room.id, panel: "inspector" });
    } else if (preview && (d.kind === "move" || d.kind === "resize")) {
      dispatch({
        type: "room/update",
        id: d.room!.id,
        patch: { x: preview.x, y: preview.y, width: preview.width, length: preview.length },
      });
    }
    setPreview(null);
  }
  /** Drop a default dog-legged stair centred on the click. */
  function placeStair(p: Point) {
    const info = STAIR_TYPES["dog-legged"],
      id = newId("stair"),
      result = dispatch({
        type: "stair/add",
        stair: {
          id,
          x: Math.round((p.x - info.width / 2) * 2) / 2,
          y: Math.round((p.y - info.length / 2) * 2) / 2,
          width: info.width,
          length: info.length,
          fromFloor: ui.floor,
          toFloor: ui.floor + 1,
          direction: "north",
          stairType: "dog-legged",
          turn: "left",
        },
      });
    if (result?.applied) ui.set({ selected: id, tool: "select", panel: "inspector" });
  }
  /**
   * Place the armed catalog item where the user clicked: backed onto the nearest wall
   * when the click is close to one, otherwise free-standing; if that spot is invalid,
   * the nearest valid spot in the same room. Never places anything invalid.
   */
  function placePiece(r: Room, p: Point) {
    const catalogId = ui.paletteId,
      item = catalogId ? itemFor(design, catalogId) : undefined;
    if (!catalogId || !item) return;
    const sides = (
      [
        ["north", p.y - r.y],
        ["south", r.y + r.length - p.y],
        ["west", p.x - r.x],
        ["east", r.x + r.width - p.x],
      ] as const
    )
      .slice()
      .sort((a, b) => a[1] - b[1]);
    const [side, distance] = sides[0]!,
      rotation = item.mount === "wall" || distance < item.depth + 1 ? ROTATION_FOR_WALL[side] : 0,
      inset = item.depth / 2 + 0.01,
      snapped =
        rotation === ROTATION_FOR_WALL[side] && item.mount !== "ceiling"
          ? side === "north"
            ? { x: p.x, y: r.y + inset }
            : side === "south"
              ? { x: p.x, y: r.y + r.length - inset }
              : side === "west"
                ? { x: r.x + inset, y: p.y }
                : { x: r.x + r.width - inset, y: p.y }
          : p,
      base = { id: newId("piece"), catalogId, roomId: r.id, floor: r.floor },
      direct = {
        ...base,
        x: Math.round(snapped.x * 4) / 4,
        y: Math.round(snapped.y * 4) / 4,
        rotation,
      },
      spot = validateFurniture(design, direct).ok
        ? direct
        : (() => {
            const s = findFurnitureSpot(design, r.id, catalogId, { near: p });
            return s ? { ...base, ...s } : null;
          })();
    if (!spot) {
      useDesignStore.setState({
        issues: [
          {
            level: "error",
            code: "furniture/no-space",
            message: `${item.name} does not fit anywhere in ${r.name}.`,
          },
        ],
      });
      return;
    }
    const result = dispatch({ type: "furniture/add", piece: spot });
    if (result?.applied) ui.set({ selected: spot.id });
  }
  const pieceDown = (e: ReactPointerEvent<SVGElement>, f: PlacedFurniture) => {
    if (ui.tool !== "select" && ui.tool !== "furniture") return;
    e.stopPropagation();
    if (ui.tool === "furniture" && ui.paletteId) {
      const r = rooms.find((x) => x.id === f.roomId);
      if (r && !readOnly) placePiece(r, point(e));
      return;
    }
    ui.set({ selected: f.id, panel: "inspector" });
    if (readOnly || f.locked) return;
    svg.current?.setPointerCapture(e.pointerId);
    drag.current = { kind: "piece", start: point(e), piece: f };
  };
  const stairDown = (e: ReactPointerEvent<SVGElement>, s: Stair) => {
    if (ui.tool !== "select" || e.button === 1) return;
    e.stopPropagation();
    ui.set({ selected: s.id, panel: "inspector" });
    if (readOnly) return;
    svg.current?.setPointerCapture(e.pointerId);
    drag.current = { kind: "stair", start: point(e), stair: s };
  };
  const roomDown = (e: ReactPointerEvent<SVGElement>, r: Room) => {
    if (ui.tool === "stair") {
      e.stopPropagation();
      if (!readOnly) placeStair(point(e));
    } else if (ui.tool === "furniture") {
      e.stopPropagation();
      if (!readOnly && ui.paletteId) placePiece(r, point(e));
      else ui.set({ selected: r.id });
    } else if (ui.tool === "room") start(e, "draw");
    else if (ui.tool === "pan" || e.button === 1) start(e, "pan");
    else if (ui.tool === "door" || ui.tool === "window") {
      e.stopPropagation();
      const p = point(e),
        side = (["north", "east", "south", "west"] as const)
          .map((side) => ({
            side,
            distance:
              side === "north"
                ? Math.abs(p.y - r.y)
                : side === "south"
                  ? Math.abs(p.y - r.y - r.length)
                  : side === "east"
                    ? Math.abs(p.x - r.x - r.width)
                    : Math.abs(p.x - r.x),
          }))
          .sort((a, b) => a.distance - b.distance)[0]!.side,
        offset = Math.round((side === "north" || side === "south" ? p.x - r.x : p.y - r.y) * 2) / 2,
        id = newId("opening"),
        base = {
          id,
          roomId: r.id,
          side,
          offset,
          width: ui.tool === "door" ? 3 : 4,
          height: ui.tool === "door" ? 7 : 4,
        };
      const result = dispatch(
        ui.tool === "door"
          ? { type: "door/add", door: { ...base, doorType: "panel", swing: "left" } }
          : { type: "window/add", window: { ...base, windowType: "casement", sill: 3 } },
      );
      if (result?.applied) ui.set({ selected: id, tool: "select" });
    } else if (ui.tool === "select") start(e, "move", r);
  };
  const down = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (ui.tool === "pan" || e.button === 1) start(e, "pan");
    else if (ui.tool === "room") start(e, "draw");
    else if (ui.tool === "stair" && !readOnly) placeStair(point(e));
    else if (ui.tool === "measure") {
      const p = snapPoint(point(e), rooms, ui.snap);
      setMeasure((m) => (m.length === 1 ? [m[0]!, p] : [p]));
    } else ui.set({ selected: null });
  };
  return (
    <div className="canvas-wrap">
      <svg
        ref={svg}
        data-testid="plan-canvas"
        aria-label="Measured floor plan"
        className="plan-canvas"
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={() => {
          drag.current = null;
          setPreview(null);
          setStairPreview(null);
          setPiecePreview(null);
        }}
      >
        <defs>
          <pattern id="plan-grid" width="1" height="1" patternUnits="userSpaceOnUse">
            <path d="M1 0H0v1" fill="none" stroke="#98a188" strokeOpacity=".3" strokeWidth=".04" />
          </pattern>
          <pattern
            id="well-hatch"
            width=".6"
            height=".6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <path d="M0 0V.6" stroke="#8b8273" strokeWidth=".06" />
          </pattern>
        </defs>
        <rect x={-1000} y={-1000} width={2000} height={2000} fill="var(--soft)" />
        <rect
          x={0}
          y={0}
          width={design.plot.width}
          height={design.plot.length}
          fill="url(#plan-grid)"
          stroke="#7d8d68"
          strokeWidth=".15"
        />
        <text
          x={design.plot.width / 2}
          y={-4.1}
          fontSize=".85"
          textAnchor="middle"
          fill="var(--muted)"
        >
          {design.plot.roadSide.toUpperCase()}-FACING ROAD
        </text>
        <path
          d={`M${design.plot.width + 2} 1v-3m-.6.6.6-.6.6.6`}
          stroke="var(--text)"
          fill="none"
          strokeWidth=".1"
        />
        <text
          x={design.plot.width + 2}
          y={-2.6}
          textAnchor="middle"
          fontSize=".85"
          fill="var(--text)"
        >
          N
        </text>
        <CompoundLayer design={design} />
        {(() => {
          const b = buildableRect(design.plot);
          return (
            <rect
              data-setback-line="true"
              x={b.x}
              y={b.y}
              width={b.width}
              height={b.length}
              fill="none"
              stroke="#b65036"
              strokeOpacity=".45"
              strokeWidth=".08"
              strokeDasharray=".5 .3"
              pointerEvents="none"
            />
          );
        })()}
        {ui.floor > 0 &&
          design.rooms
            .filter((r) => r.floor === ui.floor - 1)
            .map((r) => (
              <rect
                key={`below-${r.id}`}
                data-floor-below={r.id}
                x={r.x}
                y={r.y}
                width={r.width}
                height={r.length}
                fill="none"
                stroke="#9a937f"
                strokeWidth=".06"
                strokeDasharray=".2 .2"
                pointerEvents="none"
              />
            ))}
        {rooms.map((original) => {
          const r = preview?.id === original.id ? preview : original;
          return (
            <g
              key={r.id}
              data-room-id={r.id}
              onPointerDown={(e) => roomDown(e, r)}
              style={{ cursor: readOnly ? "default" : ui.tool === "select" ? "move" : "crosshair" }}
            >
              <rect
                x={r.x}
                y={r.y}
                width={r.width}
                height={r.length}
                rx={0.06}
                fill={ROOM_INFO[r.type].color}
                stroke={r.id === ui.selected ? "#b65036" : "#756e61"}
                strokeWidth={r.id === ui.selected?.toString() ? ".25" : ".1"}
              />
              <g style={{ pointerEvents: "none" }}>
                <text
                  x={r.x + r.width / 2}
                  y={r.y + r.length / 2 - 0.2}
                  fontSize={Math.min(0.85, r.width / 10)}
                  textAnchor="middle"
                  fill="#4d4d40"
                >
                  {r.name}
                  {r.locked ? " 🔒" : ""}
                </text>
                <text
                  x={r.x + r.width / 2}
                  y={r.y + r.length / 2 + 1}
                  fontSize=".65"
                  textAnchor="middle"
                  fill="#787768"
                >
                  {areaLabel(r.width * r.length, design.plot.unit)}
                </text>
              </g>
            </g>
          );
        })}
        <StairLayer
          design={
            stairPreview
              ? {
                  ...design,
                  stairs: design.stairs.map((x) => (x.id === stairPreview.id ? stairPreview : x)),
                }
              : design
          }
          floor={ui.floor}
          onStairDown={stairDown}
        />
        <WallLayer design={design} floor={ui.floor} readOnly={readOnly} />
        <FurnitureLayer
          design={design}
          floor={ui.floor}
          preview={piecePreview}
          onPieceDown={pieceDown}
        />
        {preview?.id === "preview" && (
          <rect
            x={preview.x}
            y={preview.y}
            width={preview.width}
            height={preview.length}
            fill="#b6503625"
            stroke="#b65036"
            strokeWidth=".15"
            strokeDasharray=".3 .2"
            pointerEvents="none"
          />
        )}
        {selected &&
          !readOnly &&
          ui.tool === "select" &&
          !selected.locked &&
          [
            ["nw", 0, 0],
            ["n", 0.5, 0],
            ["ne", 1, 0],
            ["e", 1, 0.5],
            ["se", 1, 1],
            ["s", 0.5, 1],
            ["sw", 0, 1],
            ["w", 0, 0.5],
          ].map(([handle, fx, fy]) => (
            <rect
              data-resize-handle={handle}
              key={handle as string}
              x={selected.x + Number(fx) * selected.width - 0.23}
              y={selected.y + Number(fy) * selected.length - 0.23}
              width={0.46}
              height={0.46}
              fill="var(--panel)"
              stroke="#b65036"
              strokeWidth=".08"
              onPointerDown={(e) => start(e, "resize", selected, String(handle))}
              style={{ cursor: `${handle}-resize` }}
            />
          ))}
        <Dimension
          x={0}
          y={design.plot.length + 2}
          length={design.plot.width}
          unit={design.plot.unit}
        />
        <Dimension
          x={-2}
          y={design.plot.length}
          length={design.plot.length}
          vertical
          unit={design.plot.unit}
        />
        {selected && (
          <Dimension
            x={selected.x}
            y={selected.y - 0.8}
            length={selected.width}
            unit={design.plot.unit}
          />
        )}
        {measure.length === 2 && (
          <g pointerEvents="none">
            <path
              d={`M${measure[0]!.x} ${measure[0]!.y}L${measure[1]!.x} ${measure[1]!.y}`}
              stroke="#b65036"
              strokeWidth=".12"
              strokeDasharray=".3 .15"
            />
            <text
              x={(measure[0]!.x + measure[1]!.x) / 2}
              y={(measure[0]!.y + measure[1]!.y) / 2 - 0.5}
              fill="#b65036"
              fontSize=".9"
            >
              {Math.hypot(measure[1]!.x - measure[0]!.x, measure[1]!.y - measure[0]!.y).toFixed(1)}{" "}
              ft
            </text>
          </g>
        )}
      </svg>
      <div className="canvas-controls">
        <button
          aria-label="Zoom out"
          onClick={() => setView((v) => ({ ...v, w: v.w * 1.2, h: v.h * 1.2 }))}
        >
          −
        </button>
        <button
          aria-label="Fit plan"
          onClick={() =>
            setView({ x: -5, y: -7, w: design.plot.width + 10, h: design.plot.length + 14 })
          }
        >
          Fit
        </button>
        <button
          aria-label="Zoom in"
          onClick={() => setView((v) => ({ ...v, w: v.w * 0.8, h: v.h * 0.8 }))}
        >
          +
        </button>
      </div>
      {rooms.length === 0 && (
        <div className="empty-plan-hint">
          <strong>{ui.floor === 0 ? "This is where your home begins." : "An empty floor."}</strong>
          <span>
            {ui.floor === 0
              ? "Choose Draw room and drag on the plot."
              : "Dashed outlines show the floor below. Draw rooms over them."}
          </span>
        </div>
      )}
    </div>
  );
}
