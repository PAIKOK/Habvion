import { useDesignStore } from "../state/designStore";
import { useEditorStore } from "../state/editorStore";
import { NumberField, SelectField } from "../ui/Fields";
import { DOOR_TYPES, WINDOW_TYPES } from "@shared/design/openingTypes";
import {
  DOOR_TYPE_IDS,
  WINDOW_TYPE_IDS,
  type HomeDesign,
  type Door,
  type WindowOpening,
  type Side,
  type DoorType,
  type WindowType,
} from "@shared/types/home";
export function OpeningInspector({
  design,
  opening,
}: {
  design: HomeDesign;
  opening: Door | WindowOpening;
}) {
  const dispatch = useDesignStore((s) => s.dispatch),
    ui = useEditorStore(),
    isDoor = "doorType" in opening;
  function patch(p: Record<string, unknown>) {
    dispatch(
      isDoor
        ? { type: "door/update", id: opening.id, patch: p }
        : { type: "window/update", id: opening.id, patch: p },
    );
  }
  return (
    <aside className="inspector">
      <div className="inspector-heading">
        <p className="eyebrow">ANCHORED TO THE ROOM, NOT A WALL ID</p>
        <h2>{isDoor ? "Door" : "Window"}</h2>
        <p>
          {design.rooms.find((r) => r.id === opening.roomId)?.name} · {opening.side} wall
        </p>
      </div>
      <SelectField
        label="Opening type"
        value={isDoor ? opening.doorType : opening.windowType}
        onChange={(v) =>
          patch(isDoor ? { doorType: v as DoorType } : { windowType: v as WindowType })
        }
        options={(isDoor ? DOOR_TYPE_IDS : WINDOW_TYPE_IDS).map((value) => ({
          value,
          label: isDoor
            ? DOOR_TYPES[value as DoorType].label
            : WINDOW_TYPES[value as WindowType].label,
        }))}
      />
      <SelectField
        label="Wall side"
        value={opening.side}
        onChange={(side) => patch({ side: side as Side })}
        options={["north", "east", "south", "west"].map((value) => ({ value, label: value }))}
      />
      <NumberField
        label="Centre offset"
        value={opening.offset}
        unit={design.plot.unit}
        onCommit={(offset) => patch({ offset })}
      />
      <div className="fields-row">
        <NumberField
          label="Opening width"
          value={opening.width}
          unit={design.plot.unit}
          onCommit={(width) => patch({ width })}
        />
        <NumberField
          label="Opening height"
          value={opening.height}
          unit={design.plot.unit}
          onCommit={(height) => patch({ height })}
        />
      </div>
      {isDoor ? (
        <SelectField
          label="Hinge end"
          value={opening.swing}
          onChange={(swing) => patch({ swing })}
          options={[
            { value: "left", label: "Start end" },
            { value: "right", label: "End end" },
          ]}
        />
      ) : (
        <NumberField
          label="Sill height"
          value={opening.sill}
          unit={design.plot.unit}
          onCommit={(sill) => patch({ sill })}
        />
      )}
      <p className="small-note">
        The offset measures to the centre, from the north or west end. Keep 0.5 ft clear at the
        corners.
      </p>
      <button
        className="button button-danger w-full mt-6"
        onClick={() => {
          const r = dispatch({ type: isDoor ? "door/delete" : "window/delete", id: opening.id });
          if (r?.applied) ui.set({ selected: null });
        }}
      >
        Delete {isDoor ? "door" : "window"}
      </button>
    </aside>
  );
}
