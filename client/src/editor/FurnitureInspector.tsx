import { useDesignStore } from "../state/designStore";
import { useEditorStore } from "../state/editorStore";
import { NumberField } from "../ui/Fields";
import { itemFor } from "@shared/design/catalog";
import { inr } from "@shared/lib/units";
import type { HomeDesign, PlacedFurniture } from "@shared/types/home";

export function FurnitureInspector({
  design,
  piece,
}: {
  design: HomeDesign;
  piece: PlacedFurniture;
}) {
  const dispatch = useDesignStore((s) => s.dispatch),
    ui = useEditorStore(),
    item = itemFor(design, piece.catalogId)!,
    room = design.rooms.find((r) => r.id === piece.roomId),
    patch = (p: Partial<PlacedFurniture>) =>
      dispatch({ type: "furniture/update", id: piece.id, patch: p });
  return (
    <aside className="inspector">
      <div className="inspector-heading">
        <p className="eyebrow">FURNITURE · {item.category.toUpperCase()}</p>
        <h2>{item.name}</h2>
        <p>
          {room?.name} · {item.width} × {item.depth} × {item.height} ft ·{" "}
          {item.price ? inr(item.price) : "no build cost"}
        </p>
      </div>
      <h3>Rotation</h3>
      <div className="rotate-row">
        {[0, 90, 180, 270].map((r) => (
          <button
            key={r}
            className={((piece.rotation % 360) + 360) % 360 === r ? "active" : ""}
            onClick={() => patch({ rotation: r })}
            aria-label={`Rotate to ${r} degrees`}
          >
            {r === 0 ? "S" : r === 90 ? "W" : r === 180 ? "N" : "E"}
          </button>
        ))}
      </div>
      <p className="small-note">Letters show which way it faces. Press R to turn it 90°.</p>
      <h3>Centre</h3>
      <div className="fields-row">
        <NumberField
          label="Piece east"
          value={piece.x}
          unit={design.plot.unit}
          onCommit={(x) => patch({ x })}
        />
        <NumberField
          label="Piece south"
          value={piece.y}
          unit={design.plot.unit}
          onCommit={(y) => patch({ y })}
        />
      </div>
      <label className="check-field">
        <input
          type="checkbox"
          checked={!!piece.locked}
          onChange={(e) => patch({ locked: e.target.checked })}
        />{" "}
        Lock piece
      </label>
      <p className="small-note">
        Mounted on the {item.mount}
        {item.mountHeightFt ? ` at ${item.mountHeightFt} ft` : ""}.{" "}
        {item.clearanceFt ? `Needs ${item.clearanceFt} ft clear in front.` : ""}
      </p>
      <button
        className="button button-danger w-full mt-6"
        onClick={() => {
          const r = dispatch({ type: "furniture/delete", id: piece.id });
          if (r?.applied) ui.set({ selected: null });
        }}
      >
        Remove {item.name.toLowerCase()}
      </button>
    </aside>
  );
}
