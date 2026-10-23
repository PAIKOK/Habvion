import { useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { finish, type Finish } from "./materials";

export type V3 = [number, number, number];
type Appearance = { c?: string; f?: Finish };
const boxes = new Map<string, THREE.BufferGeometry>();
function box(size: V3, radius: number) {
  const s = size.map(n => Math.max(0.001, n)) as V3;
  const r = Math.max(0, Math.min(radius, ...s.map(n => n / 2 - 0.0001)));
  const key = `${s.join(":")}:${r}`;
  if (!boxes.has(key)) boxes.set(key, r > 0.001 ? new RoundedBoxGeometry(...s, 3, r) : new THREE.BoxGeometry(...s));
  return boxes.get(key)!;
}
export function Part({ p, s, c = "#8a6240", f = "wood", radius = 0.025, rot }: { p: V3; s: V3; radius?: number; rot?: V3 } & Appearance) {
  return <mesh position={p} rotation={rot} geometry={box(s, radius)} material={finish(f, c)} castShadow={f !== "glass"} receiveShadow dispose={null} />;
}
export function Cylinder({ p, r, top = r, h, c = "#b8bdc1", f = "metal", rot, open = false, segments = 32 }: { p: V3; r: number; top?: number; h: number; rot?: V3; open?: boolean; segments?: number } & Appearance) {
  return <mesh position={p} rotation={rot} castShadow={f !== "glass"} receiveShadow>
    <cylinderGeometry args={[Math.max(0.001, top), Math.max(0.001, r), Math.max(0.001, h), segments, 1, open]} />
    <primitive object={finish(f, c)} attach="material" />
  </mesh>;
}
export function Orb({ p, s, c = "#f5f2ec", f = "fabric", rot }: { p: V3; s: V3; rot?: V3 } & Appearance) {
  return <mesh position={p} scale={s} rotation={rot} castShadow receiveShadow>
    <sphereGeometry args={[1, 24, 18]} /><primitive object={finish(f, c)} attach="material" />
  </mesh>;
}
export function Rod({ a, b, r = 0.03, top = r, c = "#b8bdc1", f = "metal" }: { a: V3; b: V3; r?: number; top?: number } & Appearance) {
  const v = useMemo(() => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), dir = end.clone().sub(start);
    return { centre: start.add(end).multiplyScalar(0.5), length: dir.length(), rotation: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()) };
  }, [a.join(","), b.join(",")]);
  return <mesh position={v.centre} quaternion={v.rotation} castShadow receiveShadow>
    <cylinderGeometry args={[top, r, Math.max(0.001, v.length), 12]} /><primitive object={finish(f, c)} attach="material" />
  </mesh>;
}
export function Pipe({ points, r = 0.025, c = "#b8bdc1", f = "metal" }: { points: V3[]; r?: number } & Appearance) {
  const geometry = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 24, r, 8, false), [JSON.stringify(points), r]);
  return <mesh geometry={geometry} material={finish(f, c)} castShadow receiveShadow />;
}
export function Ring({ p, r, tube = 0.025, c = "#b8bdc1", f = "metal", rot, arc = Math.PI * 2 }: { p: V3; r: number; tube?: number; rot?: V3; arc?: number } & Appearance) {
  return <mesh position={p} rotation={rot} castShadow receiveShadow>
    <torusGeometry args={[Math.max(0.001, r), tube, 10, 48, arc]} /><primitive object={finish(f, c)} attach="material" />
  </mesh>;
}
export function Panel({ points, c = "#263a46", f = "glass" }: { points: V3[] } & Appearance) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry(), positions: number[] = [];
    for (let i = 1; i < points.length - 1; i++) positions.push(...points[0]!, ...points[i]!, ...points[i + 1]!);
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.computeVertexNormals(); return g;
  }, [JSON.stringify(points)]);
  return <mesh geometry={geometry} material={finish(f, c)} castShadow={f !== "glass"} receiveShadow />;
}
export function Feet({ w, d, h, c = "#604733", f = "wood", inset = 0.16, thickness = 0.1 }: { w: number; d: number; h: number; inset?: number; thickness?: number } & Appearance) {
  return <>{[-1, 1].flatMap(x => [-1, 1].map(z => <Cylinder key={`${x}:${z}`} p={[x * (w / 2 - inset), h / 2, z * (d / 2 - inset)]} r={thickness / 2} top={thickness * 0.65} h={h} c={c} f={f} segments={16} />))}</>;
}
