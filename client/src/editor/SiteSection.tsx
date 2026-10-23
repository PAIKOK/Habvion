import { useDesignStore } from "../state/designStore";
import { NumberField, SelectField } from "../ui/Fields";
import { ROOF_MATERIALS, defaultCompound } from "@shared/design/finishes";
import type { Compound, Gate, HomeDesign, Roof, Side } from "@shared/types/home";

const SIDES = ["north", "east", "south", "west"].map((value) => ({ value, label: value }));

export function SiteSection({ design }: { design: HomeDesign }) {
  const dispatch = useDesignStore((s) => s.dispatch),
    unit = design.plot.unit,
    roof = design.roof,
    c = design.compound;
  const setRoof = (p: Partial<Roof>) =>
    dispatch({
      type: "roof/set",
      roof: { type: "flat", materialId: "rcc", pitchDeg: 22, overhangFt: 1.5, ...roof, ...p },
    });
  const setCompound = (p: Partial<Compound>) =>
    c && dispatch({ type: "compound/set", compound: { ...c, ...p } });
  const gateFields = (g: Gate, key: "gate" | "pedestrianGate", title: string) => (
    <div key={key}>
      <p className="mini-heading">{title}</p>
      <div className="fields-row">
        <SelectField
          label={`${title} side`}
          value={g.side}
          onChange={(v) => setCompound({ [key]: { ...g, side: v as Side } })}
          options={SIDES}
        />
        {key === "gate" ? (
          <SelectField
            label="Gate kind"
            value={g.kind}
            onChange={(v) => setCompound({ gate: { ...g, kind: v as Gate["kind"] } })}
            options={[
              { value: "sliding", label: "Sliding" },
              { value: "swing", label: "Swing" },
            ]}
          />
        ) : (
          <span />
        )}
        <NumberField
          label={`${title} centre`}
          value={g.offset}
          unit={unit}
          onCommit={(offset) => setCompound({ [key]: { ...g, offset } })}
        />
        <NumberField
          label={`${title} width`}
          value={g.width}
          unit={unit}
          onCommit={(width) => setCompound({ [key]: { ...g, width } })}
        />
      </div>
    </div>
  );
  return (
    <>
      <h3>Roof</h3>
      <SelectField
        label="Roof type"
        value={roof?.type ?? "none"}
        onChange={(v) =>
          v === "none"
            ? dispatch({ type: "roof/set", roof: null })
            : setRoof({
                type: v as Roof["type"],
                materialId:
                  v === "flat"
                    ? "rcc"
                    : roof?.materialId === "rcc" || !roof
                      ? "clay-tile"
                      : roof.materialId,
              })
        }
        options={[
          { value: "none", label: "Open terrace (no roof)" },
          { value: "flat", label: "Flat" },
          { value: "shed", label: "Shed (mono-pitch)" },
          { value: "gable", label: "Gable" },
          { value: "hip", label: "Hip" },
          { value: "pyramid", label: "Pyramid" },
        ]}
      />
      {roof && (
        <>
          <SelectField
            label="Roof material"
            value={roof.materialId}
            onChange={(materialId) => setRoof({ materialId })}
            options={Object.entries(ROOF_MATERIALS)
              .filter(([, m]) => (roof.type === "flat") !== m.pitched)
              .map(([value, m]) => ({ value, label: m.label }))}
          />
          {roof.type !== "flat" && (
            <div className="fields-row">
              <NumberField
                label="Pitch (degrees)"
                value={roof.pitchDeg}
                step={1}
                onCommit={(pitchDeg) => setRoof({ pitchDeg })}
              />
              <NumberField
                label="Overhang"
                value={roof.overhangFt}
                unit={unit}
                onCommit={(overhangFt) => setRoof({ overhangFt })}
              />
            </div>
          )}
        </>
      )}
      <h3>Compound wall</h3>
      <label className="check-field">
        <input
          type="checkbox"
          checked={!!c}
          onChange={(e) =>
            dispatch({
              type: "compound/set",
              compound: e.target.checked ? defaultCompound(design.plot) : null,
            })
          }
        />{" "}
        Boundary wall with gates
      </label>
      {c && (
        <>
          <div className="fields-row">
            <NumberField
              label="Wall height"
              value={c.height}
              unit={unit}
              onCommit={(height) => setCompound({ height })}
            />
            <NumberField
              label="Wall thickness"
              value={c.thickness}
              unit={unit}
              onCommit={(thickness) => setCompound({ thickness })}
            />
          </div>
          {gateFields(c.gate, "gate", "Main gate")}
          {c.pedestrianGate ? (
            <>
              {gateFields(c.pedestrianGate, "pedestrianGate", "Wicket gate")}
              <button
                className="text-button"
                onClick={() => setCompound({ pedestrianGate: undefined })}
              >
                Remove wicket gate
              </button>
            </>
          ) : (
            <button
              className="text-button"
              onClick={() =>
                setCompound({ pedestrianGate: defaultCompound(design.plot).pedestrianGate })
              }
            >
              Add a pedestrian (wicket) gate
            </button>
          )}
        </>
      )}
      <h3>Systems and parking</h3>
      <label className="check-field">
        <input
          type="checkbox"
          checked={design.systems.smartHome}
          onChange={(e) =>
            dispatch({ type: "systems/set", patch: { smartHome: e.target.checked } })
          }
        />{" "}
        Smart home wiring and hub
      </label>
      <label className="check-field">
        <input
          type="checkbox"
          checked={design.systems.security}
          onChange={(e) => dispatch({ type: "systems/set", patch: { security: e.target.checked } })}
        />{" "}
        Security: CCTV, video door phone, alarm
      </label>
      <SelectField
        label="Parking needed"
        value={design.parkingNeed}
        onChange={(v) => dispatch({ type: "parking/need", need: v as HomeDesign["parkingNeed"] })}
        options={[
          { value: "none", label: "None" },
          { value: "1-car", label: "One car" },
          { value: "2-car", label: "Two cars" },
        ]}
      />
    </>
  );
}
