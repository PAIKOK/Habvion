import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "../ui/Header";
import { NumberField, SelectField } from "../ui/Fields";
import { useDesignStore } from "../state/designStore";
import { api } from "../api/client";
import { ContinueStrip } from "../ui/ContinueStrip";
import { lengthLabel, areaLabel } from "@shared/lib/units";
import type { Side, Unit, HomeDesign } from "@shared/types/home";
export function PlotSetupPage() {
  const nav = useNavigate(),
    dispatch = useDesignStore((s) => s.dispatch);
  const [width, setWidth] = useState(30),
    [length, setLength] = useState(50),
    [unit, setUnit] = useState<Unit>("ft"),
    [road, setRoad] = useState<Side>("north"),
    [floors, setFloors] = useState(2),
    [parking, setParking] = useState<HomeDesign["parkingNeed"]>("1-car"),
    [setbacks, setSetbacks] = useState({ front: 5, rear: 3, left: 3, right: 3 }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <>
      <Header />
      <main id="main" tabIndex={-1} className="section-shell setup-page">
        <div className="setup-heading">
          <p className="eyebrow">01 · START WITH THE LAND</p>
          <h1>A plot of possibilities.</h1>
          <p>
            Tell us about your site. Everything is stored in feet; your preferred unit is only for
            display.
          </p>
        </div>
        <ContinueStrip />
        <div className="setup-grid">
          <form
            className="setup-card"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              const result = dispatch({
                type: "design/new",
                input: {
                  width,
                  length,
                  unit,
                  roadSide: road,
                  floors,
                  parkingNeed: parking,
                  setbacks,
                },
              });
              if (result?.applied) {
                // Save it straight away so it has a home on the server and a URL.
                setBusy(true);
                try {
                  await api("/designs", { body: { design: result.design } });
                  nav(`/editor/${result.design.id}`);
                } catch (err) {
                  setError(err instanceof Error ? `Could not save the new design: ${err.message}` : "Could not save the new design.");
                } finally {
                  setBusy(false);
                }
              } else
                setError(
                  useDesignStore.getState().issues[0]?.message ??
                    "Please check the plot dimensions.",
                );
            }}
          >
            <h3>The basics</h3>
            <SelectField
              label="Display unit"
              value={unit}
              onChange={(s) => setUnit(s as Unit)}
              options={[
                { value: "ft", label: "Feet (ft)" },
                { value: "m", label: "Metres (m)" },
              ]}
            />
            <div className="fields-row">
              <NumberField label="Plot width" value={width} onCommit={setWidth} unit={unit} />
              <NumberField label="Plot length" value={length} onCommit={setLength} unit={unit} />
            </div>
            <SelectField
              label="Road side"
              value={road}
              onChange={(s) => setRoad(s as Side)}
              options={["north", "east", "south", "west"].map((value) => ({
                value,
                label: value[0]!.toUpperCase() + value.slice(1),
              }))}
            />
            <div className="fields-row">
              <NumberField
                label="Number of floors"
                value={floors}
                onCommit={setFloors}
                min={1}
                step={1}
              />
              <SelectField
                label="Parking need"
                value={parking}
                onChange={(s) => setParking(s as HomeDesign["parkingNeed"])}
                options={[
                  { value: "none", label: "No parking" },
                  { value: "1-car", label: "1 car" },
                  { value: "2-car", label: "2 cars" },
                ]}
              />
            </div>
            <h3 className="mt-7">Setbacks</h3>
            <p className="small-note">
              Suggested margins, not a local bye-law certification. Left is clockwise from the road.
            </p>
            <div className="fields-row">
              {(["front", "rear", "left", "right"] as const).map((k) => (
                <NumberField
                  key={k}
                  label={`${k[0]!.toUpperCase() + k.slice(1)} setback`}
                  value={setbacks[k]}
                  onCommit={(n) => setSetbacks((s) => ({ ...s, [k]: n }))}
                  unit={unit}
                />
              ))}
            </div>
            {error && (
              <p role="alert" className="error-text">
                {error}
              </p>
            )}
            <button className="button button-accent button-large w-full mt-5" type="submit">
              Create my plot →
            </button>
          </form>
          <div className="setup-preview">
            <div className="preview-eyebrow">YOUR SITE · NORTH IS UP</div>
            <svg
              aria-label="Plot setup preview"
              viewBox={`-8 -9 ${width + 16} ${length + 22}`}
              className="setup-svg"
            >
              <defs>
                <pattern id="setup-grid" width="2" height="2" patternUnits="userSpaceOnUse">
                  <path d="M2 0H0v2" fill="none" stroke="#9fa596" strokeWidth=".08" />
                </pattern>
              </defs>
              <rect
                x="0"
                y="0"
                width={width}
                height={length}
                fill="url(#setup-grid)"
                stroke="#8c9b77"
                strokeWidth=".3"
              />
              <path d={`M0-3h${width}`} stroke="#b65036" strokeWidth="1.5" />
              <text x={width / 2} y="-5" textAnchor="middle" fontSize="1.5" fill="var(--muted)">
                {road.toUpperCase()}-FACING ROAD
              </text>
              <text
                x={width / 2}
                y={length + 5}
                textAnchor="middle"
                fontSize="2"
                fill="var(--text)"
              >
                {lengthLabel(width, unit)}
              </text>
              <text
                x="-4"
                y={length / 2}
                textAnchor="middle"
                fontSize="2"
                fill="var(--text)"
                transform={`rotate(-90,-4,${length / 2})`}
              >
                {lengthLabel(length, unit)}
              </text>
              <text
                x={width / 2}
                y={length / 2 - 1}
                textAnchor="middle"
                fontSize="2.2"
                fill="var(--text)"
              >
                A fresh beginning
              </text>
              <text
                x={width / 2}
                y={length / 2 + 3}
                textAnchor="middle"
                fontSize="1.6"
                fill="var(--muted)"
              >
                {areaLabel(width * length, unit)}
              </text>
            </svg>
            <p>Rooms, walls and furniture will all be measured against this plot.</p>
          </div>
        </div>
      </main>
    </>
  );
}
