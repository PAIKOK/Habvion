import type { FurnitureItem } from "@shared/types/home";

type V3 = [number, number, number];
const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16),
    c = (s: number) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * k)));
  return `#${((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, "0")}`;
};
function B({ p, s, c, r = 0.7, m = 0 }: { p: V3; s: V3; c: string; r?: number; m?: number }) {
  return (
    <mesh position={p} castShadow receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} roughness={r} metalness={m} />
    </mesh>
  );
}
function Cyl({ p, r0, r1 = r0, h, c, rot, seg = 20, m = 0 }: { p: V3; r0: number; r1?: number; h: number; c: string; rot?: V3; seg?: number; m?: number }) {
  return (
    <mesh position={p} rotation={rot} castShadow receiveShadow>
      <cylinderGeometry args={[r1, r0, h, seg]} />
      <meshStandardMaterial color={c} roughness={0.6} metalness={m} />
    </mesh>
  );
}
function Sph({ p, r, c, s = [1, 1, 1] }: { p: V3; r: number; c: string; s?: V3 }) {
  return (
    <mesh position={p} scale={s} castShadow>
      <sphereGeometry args={[r, 18, 14]} />
      <meshStandardMaterial color={c} roughness={0.85} />
    </mesh>
  );
}
const legs = (w: number, d: number, h: number, c: string, inset = 0.12, t = 0.12) =>
  [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].map(([a, b], i) => <B key={`leg${i}`} p={[a! * (w / 2 - inset), h / 2, b! * (d / 2 - inset)]} s={[t, h, t]} c={c} />);

/**
 * A procedural model inside the item's catalog box: origin at the footprint centre on
 * the floor, width along X, depth along Z, the front facing +Z.
 */
export function BuiltShape({ item }: { item: FurnitureItem }) {
  const { width: w, depth: d, height: h, colorHex: c } = item,
    dark = shade(c, 0.7),
    wood = "#7b5a3c",
    steel = "#b9bec3",
    white = "#f4f3ef";
  switch (item.shape) {
    case "sofa":
    case "armchair": {
      const seatH = h * 0.42,
        arm = Math.min(0.55, w * 0.13),
        back = Math.min(0.75, d * 0.27),
        seats = item.shape === "armchair" ? 1 : Math.max(1, Math.round((w - 2 * arm) / 2.2)),
        cw = (w - 2 * arm) / seats;
      return (
        <group>
          <B p={[0, 0.35 + (seatH - 0.35) / 2, 0]} s={[w, seatH - 0.35, d]} c={dark} />
          {Array.from({ length: seats }, (_, i) => (
            <B key={i} p={[-w / 2 + arm + cw * (i + 0.5), seatH + 0.18, back / 2]} s={[cw - 0.06, 0.36, d - back - 0.05]} c={c} r={0.95} />
          ))}
          <B p={[0, seatH + (h - seatH) / 2, -d / 2 + back / 2]} s={[w, h - seatH, back]} c={c} r={0.95} />
          {[-1, 1].map((k) => (
            <B key={k} p={[k * (w / 2 - arm / 2), (seatH + 0.45) / 2 + 0.17, 0]} s={[arm, seatH + 0.45 - 0.35, d]} c={c} r={0.95} />
          ))}
          {legs(w, d, 0.35, "#3b2f26", 0.2, 0.1)}
        </group>
      );
    }
    case "chair": {
      const seat = Math.min(1.55, h * 0.5);
      return (
        <group>
          {legs(w, d, seat - 0.08, c, 0.1, 0.09)}
          <B p={[0, seat, 0]} s={[w, 0.12, d]} c={c} />
          <B p={[0, seat + 0.06 + 0.04, 0.05]} s={[w - 0.12, 0.08, d - 0.2]} c={shade(c, 1.25)} r={0.95} />
          <B p={[0, (seat + h) / 2 + 0.05, -d / 2 + 0.06]} s={[w, h - seat - 0.1, 0.1]} c={c} />
        </group>
      );
    }
    case "diwan":
      return (
        <group>
          <B p={[0, h * 0.3, 0]} s={[w, h * 0.6, d]} c={wood} />
          <B p={[0, h * 0.6 + 0.2, 0]} s={[w - 0.1, 0.4, d - 0.1]} c={c} r={0.95} />
          {[-1, 1].map((k) => (
            <Cyl key={k} p={[k * (w / 2 - 0.35), h * 0.6 + 0.6, 0]} r0={0.3} h={d - 0.3} c={shade(c, 1.2)} rot={[Math.PI / 2, 0, 0]} />
          ))}
        </group>
      );
    case "swing":
      return (
        <group>
          {[-1, 1].map((k) => (
            <B key={k} p={[k * (w / 2 - 0.1), h / 2, 0]} s={[0.2, h, 0.2]} c={wood} />
          ))}
          <B p={[0, h - 0.1, 0]} s={[w, 0.2, 0.25]} c={wood} />
          <B p={[0, 1.6, 0]} s={[w - 1, 0.15, 1.4]} c={c} />
          <B p={[0, 2.3, -0.65]} s={[w - 1, 1.3, 0.1]} c={c} />
          {[-1, 1].map((k) => (
            <Cyl key={`ch${k}`} p={[k * (w / 2 - 0.6), (h + 1.6) / 2, 0]} r0={0.03} h={h - 1.6} c={steel} m={0.8} />
          ))}
        </group>
      );
    case "table": {
      const round = Math.abs(w - d) < 0.01 && /round/.test(item.id),
        top = 0.12;
      return (
        <group>
          {round ? (
            <>
              <Cyl p={[0, h - top / 2, 0]} r0={w / 2} h={top} c={c} seg={36} />
              <Cyl p={[0, (h - top) / 2, 0]} r0={0.14} h={h - top} c={dark} />
              <Cyl p={[0, 0.05, 0]} r0={w / 4} h={0.1} c={dark} />
            </>
          ) : (
            <>
              <B p={[0, h - top / 2, 0]} s={[w, top, d]} c={c} r={0.5} />
              {legs(w, d, h - top, dark, 0.2, 0.15)}
              {item.id === "carrom" && <B p={[0, h + 0.02, 0]} s={[w - 0.4, 0.04, d - 0.4]} c="#e8d3a6" />}
              {/pool|tennis/.test(item.id) && <B p={[0, h + 0.02, 0]} s={[w - 0.3, 0.04, d - 0.3]} c={item.id.includes("pool") ? "#2d6a3e" : "#2f5d50"} />}
            </>
          )}
        </group>
      );
    }
    case "desk":
      return (
        <group>
          <B p={[0, h - 0.06, 0]} s={[w, 0.12, d]} c={c} />
          <B p={[-w / 2 + 0.06, (h - 0.12) / 2, 0]} s={[0.1, h - 0.12, d - 0.1]} c={dark} />
          <B p={[w / 2 - 0.65, (h - 0.12) / 2, 0]} s={[1.2, h - 0.12, d - 0.1]} c={dark} />
          {[0.6, 1.3, 2].filter((y) => y < h - 0.2).map((y) => (
            <B key={y} p={[w / 2 - 0.65, y, d / 2 - 0.03]} s={[0.35, 0.04, 0.04]} c={steel} m={0.7} />
          ))}
          {item.id === "dressing-table" && <B p={[0, h + 1.4, -d / 2 + 0.08]} s={[w * 0.6, 2.6, 0.08]} c="#cfdde1" m={0.6} r={0.1} />}
        </group>
      );
    case "bed": {
      const frame = Math.min(1.1, h * 0.5),
        head = Math.max(h + 1.6, 3.4),
        bunk = item.id === "bunk-bed";
      return (
        <group>
          <B p={[0, frame / 2, 0.15]} s={[w, frame, d - 0.3]} c={c} />
          <B p={[0, frame + 0.35, 0.2]} s={[w - 0.2, 0.7, d - 0.5]} c={white} r={0.95} />
          <B p={[0, frame + 0.45, d * 0.2]} s={[w - 0.1, 0.62, d * 0.55]} c={shade(c, 1.45)} r={0.95} />
          <B p={[0, (bunk ? h : head) / 2, -d / 2 + 0.15]} s={[w, bunk ? h : head, 0.3]} c={dark} />
          {Array.from({ length: w > 4 ? 2 : 1 }, (_, i, ) => (
            <B key={i} p={[w > 4 ? (i ? 1 : -1) * w * 0.23 : 0, frame + 0.85, -d / 2 + 1]} s={[w > 4 ? w * 0.4 : w * 0.7, 0.35, 1]} c="#fbfaf6" r={0.95} />
          ))}
          {bunk && (
            <>
              <B p={[0, h * 0.62, 0.15]} s={[w, 0.3, d - 0.3]} c={c} />
              <B p={[0, h * 0.62 + 0.4, 0.2]} s={[w - 0.2, 0.5, d - 0.5]} c={white} r={0.95} />
              <B p={[0, h / 2, d / 2 - 0.1]} s={[w, h, 0.15]} c={dark} />
            </>
          )}
        </group>
      );
    }
    case "wardrobe":
    case "cabinet": {
      const doors = Math.max(1, Math.round(w / (item.shape === "wardrobe" ? 2 : 1.5)));
      return (
        <group>
          <B p={[0, h / 2 + 0.1, 0]} s={[w, h - 0.2, d]} c={c} />
          <B p={[0, 0.05, 0.05]} s={[w - 0.1, 0.1, d - 0.1]} c={dark} />
          {Array.from({ length: doors - 1 }, (_, i) => (
            <B key={i} p={[-w / 2 + (w / doors) * (i + 1), h / 2 + 0.1, d / 2]} s={[0.025, h - 0.3, 0.02]} c={dark} />
          ))}
          {Array.from({ length: doors }, (_, i) => (
            <B key={`h${i}`} p={[-w / 2 + (w / doors) * (i + 0.5) + (i % 2 ? -0.25 : 0.25) * Math.min(1, w / doors), Math.min(h * 0.55, 3.6), d / 2 + 0.03]} s={[0.04, Math.min(0.8, h * 0.25), 0.04]} c={steel} m={0.8} />
          ))}
          {item.id === "tv-unit" && <B p={[0, h * 0.55, d / 2 - 0.01]} s={[w * 0.4, h * 0.35, 0.02]} c={dark} />}
        </group>
      );
    }
    case "shelf": {
      const rows = Math.max(1, Math.round(h / 1.2));
      return (
        <group>
          {[-1, 1].map((k) => (
            <B key={k} p={[k * (w / 2 - 0.04), h / 2, 0]} s={[0.08, h, d]} c={c} />
          ))}
          {Array.from({ length: rows + 1 }, (_, i) => (
            <B key={i} p={[0, (h / rows) * i + (i === rows ? -0.04 : 0.04), 0]} s={[w, 0.07, d]} c={c} />
          ))}
          {h > 2 &&
            Array.from({ length: rows }, (_, i) => (
              <B key={`b${i}`} p={[-w * 0.15, (h / rows) * i + 0.45, 0]} s={[w * 0.5, 0.7, d * 0.7]} c={["#8f4b3a", "#3f6e8c", "#c9a24d", "#4f7a46"][i % 4]!} />
            ))}
          {item.id === "jaali-screen" && <B p={[0, h / 2, 0]} s={[w - 0.1, h - 0.1, 0.05]} c={dark} />}
        </group>
      );
    }
    case "counter":
      return (
        <group>
          <B p={[0, 0.25, 0.08]} s={[w, 0.5, d - 0.16]} c="#3e3a36" />
          <B p={[0, 1.65, 0]} s={[w, 2.3, d - 0.05]} c="#d9cfbf" />
          <B p={[0, h - 0.07, 0]} s={[w, 0.14, d]} c="#57524c" r={0.25} />
          {Array.from({ length: Math.max(1, Math.round(w / 2)) - 1 }, (_, i) => (
            <B key={i} p={[-w / 2 + (w / Math.max(1, Math.round(w / 2))) * (i + 1), 1.65, d / 2]} s={[0.02, 2.2, 0.02]} c="#a99f90" />
          ))}
        </group>
      );
    case "sink":
      return (
        <group>
          <B p={[0, 0.02, 0]} s={[w, 0.04, d]} c={steel} m={0.8} r={0.3} />
          {[-1, 1].map((k) => (
            <B key={k} p={[(k * w) / 4, 0.03, 0.05]} s={[w / 2 - 0.2, 0.02, d - 0.5]} c="#8b9196" m={0.8} r={0.3} />
          ))}
          <Cyl p={[0, 0.5, -d / 2 + 0.2]} r0={0.05} h={1} c={steel} m={0.9} />
          <B p={[0, 0.95, -d / 2 + 0.45]} s={[0.07, 0.07, 0.55]} c={steel} m={0.9} />
        </group>
      );
    case "hob":
      return (
        <group>
          <B p={[0, h / 2, 0]} s={[w, h, d]} c="#1d1d1d" r={0.15} m={0.3} />
          {[
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ].map(([a, b], i) => (
            <Cyl key={i} p={[(a! * w) / 4, h + 0.03, (b! * d) / 4]} r0={0.22} h={0.06} c="#55524f" m={0.6} />
          ))}
        </group>
      );
    case "chimney":
      return (
        <group>
          <Cyl p={[0, 0.4, 0]} r0={w / 1.6} r1={0.45} h={0.8} c={steel} seg={4} m={0.8} />
          <B p={[0, h * 0.7, -d / 2 + 0.4]} s={[0.9, h * 0.8, 0.7]} c={steel} m={0.8} />
        </group>
      );
    case "wc":
      return (
        <group>
          <Cyl p={[0, h < 1 ? 0.12 : 0.65, d * 0.12]} r0={w * 0.42} r1={w * 0.48} h={h < 1 ? 0.24 : 1.3} c={white} seg={28} />
          {h > 1 && <B p={[0, h * 0.62, -d / 2 + 0.3]} s={[w, h * 0.75, 0.55]} c={white} r={0.2} />}
          {h > 1 && <Cyl p={[0, 1.33, d * 0.12]} r0={w * 0.48} h={0.06} c="#e9e7e1" seg={28} />}
        </group>
      );
    case "basin": {
      const vanity = w > 2.5;
      return (
        <group>
          {vanity ? <B p={[0, (h - 0.25) / 2, 0]} s={[w, h - 0.25, d]} c={c} /> : <Cyl p={[0, (h - 0.4) / 2, -0.1]} r0={0.25} r1={0.18} h={h - 0.4} c={white} />}
          {(w > 4 ? [-w / 4, w / 4] : [0]).map((x) => (
            <B key={x} p={[x, h - 0.15, 0.05]} s={[Math.min(1.8, w - 0.4), 0.3, d - 0.3]} c={white} r={0.2} />
          ))}
          {vanity && <B p={[0, h - 0.27, 0]} s={[w, 0.05, d]} c="#e8e2d6" />}
          <Cyl p={[0, h + 0.2, -d / 2 + 0.25]} r0={0.04} h={0.4} c={steel} m={0.9} />
          <B p={[0, h + 1.8, -d / 2 + 0.03]} s={[Math.min(2, w), 2.2, 0.05]} c="#cfdde1" m={0.6} r={0.1} />
        </group>
      );
    }
    case "shower":
      return (
        <group>
          <B p={[0, 0.1, 0]} s={[w, 0.2, d]} c="#e9edee" />
          <mesh position={[0, h / 2, d / 2]}>
            <boxGeometry args={[w, h, 0.04]} />
            <meshStandardMaterial color="#cfe3e8" transparent opacity={0.3} roughness={0.05} />
          </mesh>
          <Cyl p={[-w / 2 + 0.3, h - 0.6, -d / 2 + 0.3]} r0={0.25} h={0.05} c={steel} m={0.9} />
          <Cyl p={[-w / 2 + 0.3, h / 2, -d / 2 + 0.08]} r0={0.04} h={h - 1} c={steel} m={0.9} />
        </group>
      );
    case "bath":
      return (
        <group>
          <B p={[0, h / 2, 0]} s={[w, h, d]} c={white} r={0.25} />
          <B p={[0, h - 0.05, 0]} s={[w - 0.4, 0.12, d - 0.4]} c="#d9e9ee" r={0.1} />
        </group>
      );
    case "fridge":
      return (
        <group>
          <B p={[0, h / 2, 0]} s={[w, h, d]} c={c} r={0.3} m={0.4} />
          <B p={[0, h * 0.68, d / 2 + 0.005]} s={[w - 0.04, 0.03, 0.01]} c={dark} />
          {w > 2.6 && <B p={[0, h / 2, d / 2 + 0.005]} s={[0.03, h - 0.1, 0.01]} c={dark} />}
          <B p={[w > 2.6 ? -0.15 : w / 2 - 0.25, h * 0.55, d / 2 + 0.06]} s={[0.05, h * 0.3, 0.06]} c={steel} m={0.9} />
        </group>
      );
    case "washer":
      return (
        <group>
          <B p={[0, h / 2, 0]} s={[w, h, d]} c={c} r={0.4} />
          <Cyl p={[0, h * 0.45, d / 2 + 0.02]} r0={w * 0.32} h={0.05} c="#9fb3bd" rot={[Math.PI / 2, 0, 0]} m={0.5} />
          <B p={[0, h - 0.2, d / 2 + 0.01]} s={[w - 0.2, 0.25, 0.02]} c="#d0d4d6" />
        </group>
      );
    case "fan":
      return item.mount === "ceiling" ? (
        <group>
          <Cyl p={[0, h * 0.6, 0]} r0={0.04} h={h * 0.8} c={dark} />
          <Cyl p={[0, 0.15, 0]} r0={0.35} h={0.3} c={dark} m={0.4} />
          {[0, 120, 240].map((a) => (
            <group key={a} rotation={[0, (a * Math.PI) / 180, 0]}>
              <B p={[w / 4 + 0.15, 0.1, 0]} s={[w / 2 - 0.3, 0.03, 0.42]} c={c} />
            </group>
          ))}
        </group>
      ) : (
        <group>
          <Cyl p={[0, 0.05, 0]} r0={0.6} h={0.1} c="#cfcfcf" />
          <Cyl p={[0, h / 2, 0]} r0={0.05} h={h - 0.6} c="#cfcfcf" />
          <Cyl p={[0, h - 0.5, 0]} r0={0.6} h={0.25} c="#e6e6e6" rot={[Math.PI / 2, 0, 0]} />
        </group>
      );
    case "ac":
      return <B p={[0, h / 2, 0]} s={[w, h, d]} c={c} r={0.3} />;
    case "lamp":
      return item.mount === "surface" ? (
        <group>
          <Cyl p={[0, 0.5, 0]} r0={0.22} r1={0.12} h={1} c="#b89a6a" />
          <Cyl p={[0, h - 0.4, 0]} r0={w / 2} r1={w / 3} h={0.8} c={c} />
        </group>
      ) : (
        <group>
          <Cyl p={[0, 0.05, 0]} r0={w / 3} h={0.1} c={item.id === "garden-lamp" ? "#30343a" : "#3a3a3a"} />
          <Cyl p={[0, h / 2, 0]} r0={0.05} h={h} c={item.id === "diya-stand" ? "#c49a3a" : "#3a3a3a"} m={0.6} />
          <Cyl p={[0, h - 0.5, 0]} r0={w / 2} r1={w / 3} h={0.9} c={c} />
        </group>
      );
    case "sconce":
      return (
        <group>
          <B p={[0, h / 2, -d / 2 + 0.03]} s={[0.25, 0.4, 0.06]} c="#9a8a6a" m={0.6} />
          <Cyl p={[0, h / 2, 0]} r0={w / 2} r1={w / 3} h={h * 0.8} c={c} />
        </group>
      );
    case "pendant":
      return (
        <group>
          <Cyl p={[0, h * 0.75, 0]} r0={0.02} h={h * 0.5} c="#333" />
          <Cyl p={[0, h * 0.25, 0]} r0={w / 2} r1={w / 6} h={Math.max(0.2, h * 0.45)} c={c} m={0.4} />
        </group>
      );
    case "plant":
      return item.id === "fountain" ? (
        <group>
          <Cyl p={[0, 0.4, 0]} r0={w / 2} h={0.8} c="#b8b1a5" seg={28} />
          <Cyl p={[0, 0.82, 0]} r0={w / 2 - 0.15} h={0.05} c="#7fb3c4" seg={28} />
          <Cyl p={[0, h / 2 + 0.4, 0]} r0={0.15} h={h - 0.8} c="#b8b1a5" />
          <Cyl p={[0, h - 0.3, 0]} r0={0.7} h={0.2} c="#b8b1a5" />
        </group>
      ) : (
        <group>
          <Cyl p={[0, Math.min(1, h * 0.25), 0]} r0={Math.min(w, d) * 0.3} r1={Math.min(w, d) * 0.4} h={Math.min(2, h * 0.5)} c={item.id === "tulsi" ? "#c9b49a" : "#8d6e55"} />
          <Sph p={[0, h * 0.65, 0]} r={Math.min(w, d) * 0.5} s={[1, (h * 0.55) / Math.min(w, d), 1]} c={c} />
          <Sph p={[w * 0.18, h * 0.75, d * 0.1]} r={Math.min(w, d) * 0.3} c={shade(c, 1.15)} />
        </group>
      );
    case "tree":
      return item.id === "coconut-palm" ? (
        <group>
          <Cyl p={[0, h / 2, 0]} r0={0.35} r1={0.25} h={h} c="#8a6f52" />
          {Array.from({ length: 8 }, (_, i) => (
            <group key={i} position={[0, h, 0]} rotation={[0, (i * Math.PI) / 4, 0]}>
              <mesh position={[1.4, -0.4, 0]} rotation={[0, 0, -0.5]} castShadow>
                <boxGeometry args={[3, 0.05, 0.6]} />
                <meshStandardMaterial color={c} roughness={0.9} />
              </mesh>
            </group>
          ))}
        </group>
      ) : (
        <group>
          <Cyl p={[0, h * 0.25, 0]} r0={0.45} r1={0.3} h={h * 0.5} c="#6b4b33" />
          <Sph p={[0, h * 0.65, 0]} r={w * 0.45} s={[1, 0.8, 1]} c={c} />
          <Sph p={[w * 0.2, h * 0.75, -w * 0.1]} r={w * 0.3} c={shade(c, 1.15)} />
          <Sph p={[-w * 0.2, h * 0.58, w * 0.15]} r={w * 0.32} c={shade(c, 0.9)} />
        </group>
      );
    case "car":
      return (
        <group>
          <B p={[0, 1.35, 0]} s={[w, 1.6, d]} c={c} r={0.3} m={0.5} />
          <B p={[0, 2.8, -d * 0.05]} s={[w - 0.4, 1.4, d * 0.5]} c={shade(c, 0.95)} r={0.3} m={0.5} />
          <B p={[0, 2.8, d * 0.2 + 0.01]} s={[w - 0.5, 1.2, 0.02]} c="#2b3a44" r={0.05} />
          {[
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ].map(([a, b], i) => (
            <Cyl key={i} p={[a! * (w / 2 - 0.15), 0.95, b! * (d / 2 - 2.4)]} r0={0.95} h={0.6} c="#1d1d1d" rot={[0, 0, Math.PI / 2]} />
          ))}
        </group>
      );
    case "bike":
      return (
        <group>
          {[-1, 1].map((k) => (
            <mesh key={k} position={[0, 1, k * (d / 2 - 1)]} rotation={[0, Math.PI / 2, 0]} castShadow>
              <torusGeometry args={[0.95, 0.12, 10, 28]} />
              <meshStandardMaterial color="#1d1d1d" />
            </mesh>
          ))}
          <B p={[0, 1.9, 0]} s={[0.4, 0.8, d - 2.5]} c={c} m={0.4} />
          <B p={[0, h - 0.3, -d / 2 + 1.2]} s={[w, 0.1, 0.1]} c="#333" m={0.7} />
        </group>
      );
    case "rug":
      return Math.abs(w - d) < 0.01 ? (
        <Cyl p={[0, 0.02, 0]} r0={w / 2} h={0.04} c={c} seg={40} />
      ) : (
        <group>
          <B p={[0, 0.02, 0]} s={[w, 0.04, d]} c={c} r={1} />
          <B p={[0, 0.045, 0]} s={[w - 0.6, 0.01, d - 0.6]} c={shade(c, 1.2)} r={1} />
        </group>
      );
    case "mirror":
    case "art":
      return (
        <group>
          <B p={[0, h / 2, 0]} s={[w, h, Math.max(0.08, d)]} c={item.shape === "mirror" ? "#8a7a5c" : "#2b2b2b"} />
          <B p={[0, h / 2, Math.max(0.08, d) / 2 + 0.005]} s={[w - 0.2, h - 0.2, 0.01]} c={item.shape === "mirror" ? "#d7e4e8" : c} m={item.shape === "mirror" ? 0.8 : 0} r={item.shape === "mirror" ? 0.05 : 0.9} />
        </group>
      );
    case "curtain":
      return (
        <group>
          <Cyl p={[0, h - 0.05, 0]} r0={0.04} h={w + 0.4} c="#8a7a5c" rot={[0, 0, Math.PI / 2]} m={0.6} />
          {Array.from({ length: Math.ceil(w / 0.35) }, (_, i) => (
            <B key={i} p={[-w / 2 + 0.17 + i * 0.35, h / 2, (i % 2 ? 1 : -1) * 0.07]} s={[0.36, h - 0.1, 0.06]} c={c} r={1} />
          ))}
        </group>
      );
    case "mandir":
      return (
        <group>
          <B p={[0, h * 0.18, 0]} s={[w, h * 0.36, d]} c={c} />
          {[-1, 1].map((k) => (
            <Cyl key={k} p={[k * (w / 2 - 0.15), h * 0.55, d / 2 - 0.15]} r0={0.08} h={h * 0.38} c={c} />
          ))}
          <B p={[0, h * 0.55, -d / 2 + 0.1]} s={[w - 0.1, h * 0.38, 0.15]} c={shade(c, 0.8)} />
          <B p={[0, h * 0.76, 0]} s={[w, 0.12, d]} c={c} />
          <Cyl p={[0, h * 0.88, 0]} r0={Math.min(w, d) * 0.45} r1={0.04} h={h * 0.24} c="#c49a3a" seg={8} m={0.6} />
        </group>
      );
    case "tank":
      return (
        <group>
          <Cyl p={[0, h / 2, 0]} r0={w / 2} h={h} c={c} seg={28} />
          <Cyl p={[0, h + 0.1, 0]} r0={0.5} h={0.2} c={shade(c, 1.3)} />
        </group>
      );
    case "solar":
      return (
        <group>
          {[-1, 1].map((k) => (
            <B key={k} p={[k * (w / 2 - 0.3), 0.6, d / 4]} s={[0.1, 1.2, 0.1]} c={steel} m={0.7} />
          ))}
          <mesh position={[0, 1.1, 0]} rotation={[0.35, 0, 0]} castShadow>
            <boxGeometry args={[w, 0.1, d]} />
            <meshStandardMaterial color="#22324a" roughness={0.2} metalness={0.5} />
          </mesh>
        </group>
      );
    case "pergola":
      return (
        <group>
          {legs(w, d, h, c, 0.3, 0.45)}
          {[-1, 1].map((k) => (
            <B key={k} p={[0, h - 0.3, k * (d / 2 - 0.3)]} s={[w, 0.6, 0.3]} c={c} />
          ))}
          {Array.from({ length: Math.round(w / 1) - 1 }, (_, i) => (
            <B key={`s${i}`} p={[-w / 2 + 1 + i, h - 0.05, 0]} s={[0.2, 0.3, d]} c={shade(c, 1.1)} />
          ))}
        </group>
      );
    case "appliance":
      return (
        <group>
          <B p={[0, h / 2, 0]} s={[w, h, d]} c={c} r={0.4} m={0.2} />
          {d > 0.6 && h > 1 && <B p={[0, h * 0.55, d / 2 + 0.005]} s={[w * 0.8, h * 0.5, 0.01]} c={shade(c, 0.6)} r={0.2} />}
        </group>
      );
    default:
      return <B p={[0, h / 2, 0]} s={[w, h, d]} c={c} />;
  }
}
