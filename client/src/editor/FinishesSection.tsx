import { useDesignStore } from "../state/designStore";
import { SelectField } from "../ui/Fields";
import {
  FLOORING_INFO,
  PAINT_SWATCHES,
  defaultFlooring,
  flooringOf,
} from "@shared/design/finishes";
import {
  FLOORING_IDS,
  type FlooringType,
  type HomeDesign,
  type Room,
  type Side,
} from "@shared/types/home";

function Swatches({
  label,
  value,
  onPick,
  onClear,
}: {
  label: string;
  value?: string;
  onPick: (hex: string) => void;
  onClear?: () => void;
}) {
  return (
    <div className="swatch-field">
      <span>{label}</span>
      <div className="swatches" role="radiogroup" aria-label={label}>
        {PAINT_SWATCHES.map((s) => (
          <button
            key={s.hex}
            role="radio"
            aria-checked={value === s.hex}
            aria-label={`${label}: ${s.name}`}
            title={s.name}
            className={value === s.hex ? "active" : ""}
            style={{ background: s.hex }}
            onClick={() => onPick(s.hex)}
          />
        ))}
        {onClear && value && (
          <button className="swatch-clear" aria-label={`${label}: clear`} onClick={onClear}>
            ×
          </button>
        )}
      </div>
    </div>
  );
}

export function FinishesSection({ design, room }: { design: HomeDesign; room: Room }) {
  const dispatch = useDesignStore((s) => s.dispatch),
    roomCoat = design.paint.find(
      (p) => p.target.kind === "room" && p.target.roomId === room.id,
    )?.colorHex;
  return (
    <>
      <h3>Finishes</h3>
      <SelectField
        label="Flooring"
        value={flooringOf(design, room)}
        onChange={(v) =>
          dispatch({
            type: "flooring/set",
            roomId: room.id,
            flooring: v === defaultFlooring(room.type) ? null : (v as FlooringType),
          })
        }
        options={FLOORING_IDS.map((value) => ({
          value,
          label: `${FLOORING_INFO[value].label} · ₹${FLOORING_INFO[value].pricePerSqFt}/sq ft${value === defaultFlooring(room.type) ? " (default)" : ""}`,
        }))}
      />
      <Swatches
        label="Wall paint"
        value={roomCoat}
        onPick={(colorHex) =>
          dispatch({ type: "paint/set", target: { kind: "room", roomId: room.id }, colorHex })
        }
        onClear={() => dispatch({ type: "paint/clear", target: { kind: "room", roomId: room.id } })}
      />
      <details className="accent-walls">
        <summary>Accent walls</summary>
        {(["north", "east", "south", "west"] as Side[]).map((side) => {
          const own = design.paint.find(
            (p) =>
              p.target.kind === "wall" && p.target.roomId === room.id && p.target.side === side,
          )?.colorHex;
          return (
            <Swatches
              key={side}
              label={`${side[0]!.toUpperCase()}${side.slice(1)} wall`}
              value={own}
              onPick={(colorHex) =>
                dispatch({
                  type: "paint/set",
                  target: { kind: "wall", roomId: room.id, side },
                  colorHex,
                })
              }
              onClear={() =>
                dispatch({ type: "paint/clear", target: { kind: "wall", roomId: room.id, side } })
              }
            />
          );
        })}
      </details>
    </>
  );
}
