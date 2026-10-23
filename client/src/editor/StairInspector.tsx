import { useDesignStore } from "../state/designStore";
import { useEditorStore } from "../state/editorStore";
import { NumberField, SelectField } from "../ui/Fields";
import { STAIR_TYPES, stairDims, stairGeometry } from "@shared/design/stairs";
import {
  STAIR_TYPE_IDS,
  type HomeDesign,
  type Side,
  type Stair,
  type StairType,
} from "@shared/types/home";
import { floorLabel } from "@shared/lib/units";

export function StairInspector({ design, stair }: { design: HomeDesign; stair: Stair }) {
  const dispatch = useDesignStore((s) => s.dispatch),
    ui = useEditorStore(),
    unit = design.plot.unit,
    info = STAIR_TYPES[stair.stairType],
    g = stairGeometry(stair, design.floors[stair.fromFloor]?.height ?? 10),
    { across, run } = stairDims(stair);
  const patch = (p: Partial<Stair>) => dispatch({ type: "stair/update", id: stair.id, patch: p });
  /** Keep across/along when the direction swings between the two axes. */
  const turnTo = (direction: Side) => {
    const ns = (d: Side) => d === "north" || d === "south";
    patch(
      ns(direction) === ns(stair.direction)
        ? { direction }
        : { direction, width: stair.length, length: stair.width },
    );
  };
  return (
    <aside className="inspector">
      <div className="inspector-heading">
        <p className="eyebrow">STAIR · COMPUTED TREADS</p>
        <h2>{info.label} stair</h2>
        <p>
          {floorLabel(stair.fromFloor)} → {floorLabel(stair.toFloor)} · {g.risers} risers of{" "}
          {g.riseIn.toFixed(1)}″
        </p>
      </div>
      <SelectField
        label="Stair type"
        value={stair.stairType}
        onChange={(v) => {
          const t = STAIR_TYPES[v as StairType],
            ns = stair.direction === "north" || stair.direction === "south";
          patch({
            stairType: v as StairType,
            width: ns ? t.width : t.length,
            length: ns ? t.length : t.width,
          });
        }}
        options={STAIR_TYPE_IDS.map((value) => ({ value, label: STAIR_TYPES[value].label }))}
      />
      <div className="fields-row">
        <SelectField
          label="Climbs towards"
          value={stair.direction}
          onChange={(v) => turnTo(v as Side)}
          options={["north", "east", "south", "west"].map((value) => ({ value, label: value }))}
        />
        <SelectField
          label="Turns"
          value={stair.turn}
          onChange={(v) => patch({ turn: v as Stair["turn"] })}
          options={[
            { value: "left", label: "Left" },
            { value: "right", label: "Right" },
          ]}
        />
      </div>
      <h3>Position</h3>
      <div className="fields-row">
        <NumberField
          label="Stair east"
          value={stair.x}
          unit={unit}
          onCommit={(x) => patch({ x })}
        />
        <NumberField
          label="Stair south"
          value={stair.y}
          unit={unit}
          onCommit={(y) => patch({ y })}
        />
      </div>
      <h3>Size</h3>
      <div className="fields-row">
        <NumberField
          label="Stair width"
          value={stair.width}
          unit={unit}
          onCommit={(width) => patch({ width })}
        />
        <NumberField
          label="Stair length"
          value={stair.length}
          unit={unit}
          onCommit={(length) => patch({ length })}
        />
      </div>
      <p className="small-note">
        {across.toFixed(1)} ft across × {run.toFixed(1)} ft along the climb. Minimum {info.minWidth}{" "}
        × {info.minLength} ft.{" "}
        {info.halfTurn ? "Half-turn: arrives at the end it starts from." : ""} The dashed box
        upstairs is where you arrive; keep it clear of walls and bedrooms.
      </p>
      <button
        className="button button-danger w-full mt-6"
        onClick={() => {
          const r = dispatch({ type: "stair/delete", id: stair.id });
          if (r?.applied) ui.set({ selected: null });
        }}
      >
        Delete stair
      </button>
    </aside>
  );
}
