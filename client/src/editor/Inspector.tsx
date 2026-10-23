import { OpeningInspector } from "./OpeningInspector";
import { StairInspector } from "./StairInspector";
import { FurnitureInspector } from "./FurnitureInspector";
import { FinishesSection } from "./FinishesSection";
import { SiteSection } from "./SiteSection";
import { floorLabel } from "@shared/lib/units";
import { useDesignStore } from "../state/designStore";
import { useEditorStore } from "../state/editorStore";
import { NumberField, SelectField, TextField } from "../ui/Fields";
import { ROOM_INFO } from "@shared/design/roomTypes";
import {
  ROOM_TYPES,
  type HomeDesign,
  type RoomType,
  type Unit,
  type Side,
} from "@shared/types/home";
import { newId } from "@shared/design/createDesign";
export function Inspector({ design }: { design: HomeDesign }) {
  const dispatch = useDesignStore((s) => s.dispatch),
    ui = useEditorStore(),
    room = design.rooms.find((r) => r.id === ui.selected);
  const unit = design.plot.unit;
  const opening = [...design.doors, ...design.windows].find((o) => o.id === ui.selected);
  if (opening) return <OpeningInspector design={design} opening={opening} />;
  const stair = design.stairs.find((s) => s.id === ui.selected);
  if (stair) return <StairInspector design={design} stair={stair} />;
  const piece = design.furniture.find((f) => f.id === ui.selected);
  if (piece) return <FurnitureInspector design={design} piece={piece} />;
  return (
    <aside className="inspector">
      <div className="inspector-heading">
        <span className="eyebrow">{room ? "ROOM DETAILS" : "YOUR SITE"}</span>
        <h2>{room ? room.name : "The plot"}</h2>
        <p>
          {room
            ? "Measured changes. Every edit is validated."
            : "Start with the outline. Make every square foot count."}
        </p>
      </div>
      {room ? (
        <>
          <TextField
            label="Room name"
            value={room.name}
            onCommit={(name) => dispatch({ type: "room/update", id: room.id, patch: { name } })}
          />
          <SelectField
            label="Room type"
            value={room.type}
            onChange={(type) =>
              dispatch({ type: "room/update", id: room.id, patch: { type: type as RoomType } })
            }
            options={ROOM_TYPES.map((value) => ({ value, label: ROOM_INFO[value].label }))}
          />
          <h3>Position</h3>
          <div className="fields-row">
            {(["x", "y"] as const).map((k) => (
              <NumberField
                key={k}
                label={k === "x" ? "East from origin" : "South from origin"}
                value={room[k]}
                unit={unit}
                onCommit={(n) => dispatch({ type: "room/update", id: room.id, patch: { [k]: n } })}
              />
            ))}
          </div>
          <h3>Size</h3>
          <div className="fields-row">
            <NumberField
              label="Room width"
              value={room.width}
              unit={unit}
              onCommit={(width) => dispatch({ type: "room/update", id: room.id, patch: { width } })}
            />
            <NumberField
              label="Room length"
              value={room.length}
              unit={unit}
              onCommit={(length) =>
                dispatch({ type: "room/update", id: room.id, patch: { length } })
              }
            />
          </div>
          <p className="small-note">
            Minimum {ROOM_INFO[room.type].minArea} sq ft; {ROOM_INFO[room.type].minWidth} ft clear
            width.
          </p>
          <label className="check-field">
            <input
              type="checkbox"
              checked={!!room.locked}
              onChange={(e) =>
                dispatch({ type: "room/update", id: room.id, patch: { locked: e.target.checked } })
              }
            />{" "}
            Lock room
          </label>
          <FinishesSection design={design} room={room} />
          <div className="inspector-actions">
            <button
              className="button button-secondary"
              onClick={() => {
                const id = newId("room");
                const r = dispatch({
                  type: "room/duplicate",
                  id: room.id,
                  newId: id,
                  dx: room.width,
                  dy: 0,
                });
                if (r?.applied) ui.set({ selected: id });
              }}
            >
              Duplicate room
            </button>
            <button
              className="button button-danger"
              onClick={() => {
                const r = dispatch({ type: "room/delete", id: room.id });
                if (r?.applied) ui.set({ selected: null });
              }}
            >
              Delete room
            </button>
          </div>
        </>
      ) : (
        <>
          <TextField
            label="Design name"
            value={design.name}
            onCommit={(name) => dispatch({ type: "design/rename", name })}
          />
          <SelectField
            label="Display unit"
            value={unit}
            onChange={(s) => dispatch({ type: "plot/update", patch: { unit: s as Unit } })}
            options={[
              { value: "ft", label: "Feet" },
              { value: "m", label: "Metres" },
            ]}
          />
          <div className="fields-row">
            <NumberField
              label="Plot width"
              value={design.plot.width}
              unit={unit}
              onCommit={(width) => dispatch({ type: "plot/update", patch: { width } })}
            />
            <NumberField
              label="Plot length"
              value={design.plot.length}
              unit={unit}
              onCommit={(length) => dispatch({ type: "plot/update", patch: { length } })}
            />
          </div>
          <SelectField
            label="Road side"
            value={design.plot.roadSide}
            onChange={(roadSide) =>
              dispatch({ type: "plot/update", patch: { roadSide: roadSide as Side } })
            }
            options={["north", "east", "south", "west"].map((value) => ({ value, label: value }))}
          />
          <h3>Setbacks</h3>
          <div className="fields-row">
            {(["front", "rear", "left", "right"] as const).map((k) => (
              <NumberField
                key={k}
                label={`${k[0]!.toUpperCase()}${k.slice(1)} setback`}
                value={design.plot.setbacks[k]}
                unit={unit}
                onCommit={(n) =>
                  dispatch({
                    type: "plot/update",
                    patch: { setbacks: { ...design.plot.setbacks, [k]: n } },
                  })
                }
              />
            ))}
          </div>
          <p className="small-note">Front faces the road. The dashed line is the buildable edge.</p>
          <SiteSection design={design} />
          <h3>Floors</h3>
          {design.floors.map((f) => (
            <NumberField
              key={f.level}
              label={`${floorLabel(f.level)} height`}
              value={f.height}
              unit={unit}
              onCommit={(height) => dispatch({ type: "floor/height", level: f.level, height })}
            />
          ))}
          <div className="inspector-actions">
            <button
              className="button button-secondary"
              disabled={design.floors.length <= 1}
              onClick={() => {
                const r = dispatch({ type: "floors/count", count: design.floors.length - 1 });
                if (r?.applied && ui.floor >= design.floors.length - 1)
                  ui.set({ floor: design.floors.length - 2 });
              }}
            >
              Remove top floor
            </button>
          </div>
          <p className="small-note">
            Origin is the north-west corner. East is +x, south is +y. All stored dimensions are
            feet.
          </p>
        </>
      )}
    </aside>
  );
}
