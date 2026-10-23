import { useMemo, useState } from "react";
import { CATALOG, suits } from "@shared/design/catalog";
import { CATEGORIES, type FurnitureCategory, type HomeDesign } from "@shared/types/home";
import { compactInr } from "@shared/lib/units";
import { findFurnitureSpot } from "@shared/design/furniture";
import { newId } from "@shared/design/createDesign";
import { useEditorStore } from "../state/editorStore";
import { useDesignStore } from "../state/designStore";
import { ImportItemDialog } from "./ImportItemDialog";

const LABEL: Record<FurnitureCategory, string> = {
  seating: "Seating",
  tables: "Tables",
  beds: "Beds",
  storage: "Storage",
  kitchen: "Kitchen",
  bathroom: "Bath",
  appliances: "Appliances",
  lighting: "Lighting",
  decor: "Decor",
  outdoor: "Outdoor",
  vehicles: "Vehicles",
  surface: "Tabletop",
};

export function FurniturePalette({ design }: { design: HomeDesign }) {
  const ui = useEditorStore(),
    dispatch = useDesignStore((s) => s.dispatch),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState<FurnitureCategory | "all" | "room" | "mine">("all"),
    [importing, setImporting] = useState(false),
    mine = design.customItems ?? [],
    room = design.rooms.find((r) => r.id === ui.selected);
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...mine, ...CATALOG].filter(
      (i) =>
        (category === "all" ||
          (category === "mine" && i.id.startsWith("custom-")) ||
          (category === "room" ? !!room && suits(i, room.type) : category !== "mine" && i.category === category)) &&
        (!q || i.name.toLowerCase().includes(q) || i.id.includes(q)),
    );
  }, [query, category, room, mine]);
  function autoPlace(catalogId: string) {
    if (!room) return;
    const spot = findFurnitureSpot(design, room.id, catalogId);
    if (!spot) {
      useDesignStore.setState({
        issues: [
          {
            level: "error",
            code: "furniture/no-space",
            message: `No clear spot for that in ${room.name}.`,
          },
        ],
      });
      return;
    }
    // The room stays selected so several pieces can be added in a row.
    dispatch({
      type: "furniture/add",
      piece: { id: newId("piece"), catalogId, roomId: room.id, floor: room.floor, ...spot },
    });
  }
  return (
    <aside className="palette" aria-label="Furniture catalog">
      <div className="palette-head">
        <div className="palette-title">
          <p className="eyebrow">CATALOG · {CATALOG.length + mine.length} ITEMS</p>
          <button className="small-button" data-testid="import-open" onClick={() => setImporting(true)}>
            Import from a link
          </button>
        </div>
        <input
          aria-label="Search furniture"
          placeholder="Search sofa, charpai, geyser…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="chips">
          {(["all", ...(mine.length ? (["mine"] as const) : []), ...(room ? (["room"] as const) : []), ...CATEGORIES] as const).map((c) => (
            <button
              key={c}
              className={category === c ? "active" : ""}
              onClick={() => setCategory(c)}
            >
              {c === "all" ? "All" : c === "mine" ? `Your items · ${mine.length}` : c === "room" ? `For ${room!.name}` : LABEL[c]}
            </button>
          ))}
        </div>
        <p className="small-note">
          {ui.paletteId
            ? "Click inside a room to place it. Esc to cancel."
            : room
              ? `Pick an item, then click in a room — or + to auto-place in ${room.name}.`
              : "Pick an item, then click inside a room."}
        </p>
      </div>
      <ul className="palette-list">
        {items.map((i) => (
          <li key={i.id}>
            <button
              data-palette-item={i.id}
              className={ui.paletteId === i.id ? "armed" : ""}
              onClick={() =>
                ui.set({ paletteId: ui.paletteId === i.id ? null : i.id, tool: "furniture" })
              }
            >
              <span className="swatch" style={{ background: i.colorHex }} />
              <span className="palette-name">
                {i.name}
                {i.id.startsWith("custom-") && <em className="palette-mine">{i.meshJob?.status === "pending" ? "yours · making 3D…" : "yours"}</em>}
              </span>
              <small>
                {i.width}×{i.depth} ft · {i.price ? compactInr(i.price) : "—"}
              </small>
            </button>
            {room && (
              <button
                className="palette-auto"
                aria-label={`Auto-place ${i.name}`}
                title={`Auto-place in ${room.name}`}
                onClick={() => autoPlace(i.id)}
              >
                +
              </button>
            )}
          </li>
        ))}
      </ul>
      {importing && <ImportItemDialog design={design} onClose={() => setImporting(false)} />}
    </aside>
  );
}
