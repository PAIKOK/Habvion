import { Suspense, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { HomeDesign, PlacedFurniture } from "@shared/types/home";
import { itemFor } from "@shared/design/catalog";
import { footprintBounds } from "@shared/design/furniture";
import { floorLabel } from "@shared/lib/units";
import {
  SLAB,
  compound,
  elevation,
  joinery,
  pitchedRoof,
  roofEdges,
  roomFloorY,
  slabs,
  stairs,
  walls,
  type Block,
  type Tread,
} from "./houseGeometry";
import { BuiltShape } from "./BuiltShape";
import { ModelMesh } from "./ModelMesh";
import { WalkControls } from "./WalkControls";
import { WalkMinimap } from "./WalkMinimap";
import type { WalkLocation } from "@shared/design/walkLocation";

export type CameraView = "orbit" | "top" | "front" | "side" | "walk";

function BlockMesh({ b, xray }: { b: Block; xray: boolean }) {
  const see = xray && b.wall;
  return (
    <mesh position={b.pos} castShadow={!b.glass && !see} receiveShadow userData={{ wall: b.wall, floor: b.floor }}>
      <boxGeometry args={b.size} />
      {b.faces && !b.glass ? (
        b.faces.map((c, i) => (
          <meshStandardMaterial
            key={i}
            attach={`material-${i}`}
            color={c}
            roughness={0.9}
            transparent={see}
            opacity={see ? 0.16 : 1}
            depthWrite={!see}
          />
        ))
      ) : (
        <meshStandardMaterial
          color={b.color}
          roughness={b.glass ? 0.05 : b.metal ? 0.35 : 0.85}
          metalness={b.metal ? 0.7 : 0}
          transparent={b.glass || see}
          opacity={b.glass ? 0.32 : see ? 0.16 : 1}
          depthWrite={!b.glass && !see}
        />
      )}
    </mesh>
  );
}
function TreadMesh({ t }: { t: Tread }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape(t.pts.map((p) => new THREE.Vector2(p.x, -p.y)));
    return new THREE.ExtrudeGeometry(shape, { depth: t.depth, bevelEnabled: false });
  }, [t]);
  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, t.top - t.depth, 0]} castShadow receiveShadow>
      <meshStandardMaterial color={t.color} roughness={0.75} />
    </mesh>
  );
}
function RoofMesh({ design }: { design: HomeDesign }) {
  const roof = useMemo(() => pitchedRoof(design), [design]);
  const geometry = useMemo(() => {
    if (!roof) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(roof.positions, 3));
    g.computeVertexNormals();
    return g;
  }, [roof]);
  if (!roof || !geometry) return null;
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={roof.color} roughness={0.8} side={THREE.DoubleSide} />
    </mesh>
  );
}
/** Height a surface item sits at: on top of the tallest floor item under it. */
function supportHeight(d: HomeDesign, p: PlacedFurniture) {
  const item = itemFor(d, p.catalogId)!,
    b = footprintBounds(item, p),
    cx = b.x + b.width / 2,
    cy = b.y + b.length / 2;
  let h = 0;
  for (const o of d.furniture) {
    if (o.id === p.id || o.floor !== p.floor) continue;
    const oi = itemFor(d, o.catalogId);
    if (!oi || oi.mount !== "floor" || oi.shape === "rug") continue;
    const ob = footprintBounds(oi, o);
    if (cx >= ob.x && cx <= ob.x + ob.width && cy >= ob.y && cy <= ob.y + ob.length) h = Math.max(h, oi.height);
  }
  return h;
}
function Furniture({ design, maxFloor }: { design: HomeDesign; maxFloor: number }) {
  return (
    <group>
      {design.furniture
        .filter((p) => p.floor <= maxFloor)
        .map((p) => {
          const item = itemFor(design, p.catalogId),
            room = design.rooms.find((r) => r.id === p.roomId);
          if (!item || !room) return null;
          const floorY = roomFloorY(design, room),
            y =
              item.mount === "wall"
                ? floorY + (item.mountHeightFt ?? 4)
                : item.mount === "ceiling"
                  ? elevation(design, room.floor) + design.floors[room.floor]!.height - SLAB - item.height
                  : item.mount === "surface"
                    ? floorY + supportHeight(design, p)
                    : floorY;
          return (
            <group key={p.id} position={[p.x, y, p.y]} rotation={[0, (-p.rotation * Math.PI) / 180, 0]} userData={{ pieceId: p.id }}>
              {item.model || item.modelUrl ? (
                <ModelMesh item={item} fallback={<BuiltShape item={item} />} />
              ) : (
                <BuiltShape item={item} />
              )}
            </group>
          );
        })}
    </group>
  );
}

export function House({ design, maxFloor, xray }: { design: HomeDesign; maxFloor: number; xray: boolean }) {
  const parts = useMemo(() => {
    const st = stairs(design);
    return {
      blocks: [...slabs(design), ...walls(design), ...joinery(design), ...st.rails, ...roofEdges(design)],
      treads: st.treads,
      site: compound(design),
    };
  }, [design]);
  const top = design.floors.length - 1,
    showFloor = (f?: number) => f === undefined || f <= maxFloor,
    // Hide the ceilings of the cut floor so the rooms stay visible from above.
    visible = parts.blocks.filter((b) => showFloor(b.floor) && !(maxFloor < top && b.key.startsWith("ceil-") && b.floor === maxFloor));
  return (
    <group>
      {visible.map((b) => (
        <BlockMesh key={b.key} b={b} xray={xray} />
      ))}
      {parts.treads.filter((t) => showFloor(t.floor)).map((t) => (
        <TreadMesh key={t.key} t={t} />
      ))}
      {parts.site.map((b) => (
        <BlockMesh key={b.key} b={b} xray={false} />
      ))}
      {maxFloor === top && <RoofMesh design={design} />}
      <Suspense fallback={null}>
        <Furniture design={design} maxFloor={maxFloor} />
      </Suspense>
    </group>
  );
}

function Ground({ design }: { design: HomeDesign }) {
  const { width: W, length: L, roadSide } = design.plot,
    road =
      roadSide === "north"
        ? { x: W / 2, z: -12, w: W + 80, d: 20 }
        : roadSide === "south"
          ? { x: W / 2, z: L + 12, w: W + 80, d: 20 }
          : roadSide === "west"
            ? { x: -12, z: L / 2, w: 20, d: L + 80 }
            : { x: W + 12, z: L / 2, w: 20, d: L + 80 };
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[W / 2, -0.02, L / 2]} receiveShadow>
        <planeGeometry args={[W + 160, L + 160]} />
        <meshStandardMaterial color="#a7b78f" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[W / 2, -0.01, L / 2]} receiveShadow>
        <planeGeometry args={[W, L]} />
        <meshStandardMaterial color="#c9c0ad" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[road.x, 0, road.z]} receiveShadow>
        <planeGeometry args={[road.w, road.d]} />
        <meshStandardMaterial color="#5d5f61" roughness={0.95} />
      </mesh>
    </group>
  );
}

export function Scene3D({ design, initialView = "orbit" }: { design: HomeDesign; initialView?: CameraView }) {
  const top = design.floors.length - 1,
    [view, setView] = useState<CameraView>(initialView),
    [xray, setXray] = useState(false),
    [walkLocation, setWalkLocation] = useState<WalkLocation | null>(null),
    [maxFloor, setMaxFloor] = useState(top),
    cut = view === "walk" ? top : Math.min(maxFloor, top),
    { width: W, length: L, roadSide } = design.plot,
    cx = W / 2,
    cz = L / 2,
    span = Math.max(W, L),
    height = elevation(design, top) + design.floors[top]!.height,
    front: [number, number, number] =
      roadSide === "north" ? [cx, height / 2, -span * 2] : roadSide === "south" ? [cx, height / 2, L + span * 2] : roadSide === "west" ? [-span * 2, height / 2, cz] : [W + span * 2, height / 2, cz],
    side: [number, number, number] =
      roadSide === "north" || roadSide === "south" ? [W + span * 2, height / 2, cz] : [cx, height / 2, L + span * 2],
    ortho = view === "top" || view === "front" || view === "side",
    // Unit vector towards the road, and one across it: the house is seen from its front.
    toRoad = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] }[roadSide] as [number, number],
    across: [number, number] = [-toRoad[1], toRoad[0]],
    orbitAt: [number, number, number] = [
      cx + toRoad[0] * span * 1.15 + across[0] * span * 0.75,
      span * 0.7,
      cz + toRoad[1] * span * 1.15 + across[1] * span * 0.75,
    ],
    sunAt: [number, number, number] = [
      cx + toRoad[0] * span * 0.8 - across[0] * span * 0.7,
      span * 1.6,
      cz + toRoad[1] * span * 0.8 - across[1] * span * 0.7,
    ];
  return (
    <div className="scene-wrap" data-testid="scene-3d" data-view={view} data-xray={xray} data-cut={cut}>
      {/* One camera per view: remounting avoids two default cameras fighting. */}
      <Canvas
        key={view}
        shadows
        dpr={[1, 2]}
        orthographic={ortho}
        camera={
          ortho
            ? {
                position: view === "top" ? [cx, 400, cz + 0.001] : view === "front" ? front : side,
                zoom: view === "top" ? 600 / (span + 16) : 700 / (span + 30),
                near: 0.1,
                far: 3000,
              }
            : { position: orbitAt, fov: 42, near: 0.3, far: 3000 }
        }
        gl={{ preserveDrawingBuffer: true, antialias: true }}
      >
        <color attach="background" args={["#dfe7ea"]} />
        {!ortho && <fog attach="fog" args={["#dfe7ea", span * 3, span * 7]} />}
        <hemisphereLight args={["#f6f8ff", "#a89c84", 1.25]} />
        <ambientLight intensity={0.35} />
        <directionalLight
          position={sunAt}
          target-position={[cx, 0, cz]}
          intensity={2.6}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-span}
          shadow-camera-right={span}
          shadow-camera-top={span}
          shadow-camera-bottom={-span}
          shadow-camera-far={span * 5}
          shadow-bias={-0.0004}
          shadow-normalBias={0.05}
        />
        <Ground design={design} />
        <House design={design} maxFloor={cut} xray={xray} />
        {view === "walk" ? (
          <WalkControls design={design} onLocationChange={setWalkLocation} />
        ) : (
          <OrbitControls
            makeDefault
            target={[cx, ortho ? (view === "top" ? 0 : height / 2) : 4, cz]}
            enableRotate={!ortho}
            maxPolarAngle={Math.PI / 2 - 0.03}
            minDistance={8}
            maxDistance={span * 5}
          />
        )}
      </Canvas>
      <div className="scene-toolbar" role="toolbar" aria-label="3D view">
        {(["orbit", "top", "front", "side", "walk"] as const).map((v) => (
          <button key={v} aria-pressed={view === v} className={view === v ? "active" : ""} onClick={() => { if (v === "walk") setWalkLocation(null); setView(v); }}>
            {v === "orbit" ? "3D" : v === "walk" ? "Walk" : v[0]!.toUpperCase() + v.slice(1)}
          </button>
        ))}
        <span className="scene-sep" />
        <button aria-pressed={xray} className={xray ? "active" : ""} onClick={() => setXray(!xray)}>
          {xray ? "See-through" : "Solid"}
        </button>
        <select aria-label="Show floors up to" disabled={view === "walk"} title={view === "walk" ? "All floors stay visible while walking" : undefined} value={cut} onChange={(e) => setMaxFloor(Number(e.target.value))}>
          {design.floors.map((f) => (
            <option key={f.level} value={f.level}>
              {f.level === top ? "Whole house" : `Up to ${floorLabel(f.level).toLowerCase()}`}
            </option>
          ))}
        </select>
      </div>
      {view === "walk" && (
        <>
          <WalkMinimap design={design} location={walkLocation} />
          <div className="walk-hint">Click to look around · WASD to walk · Shift to hurry · Esc frees the mouse · 3D to leave</div>
        </>
      )}
    </div>
  );
}
