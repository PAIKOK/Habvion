import * as THREE from "three";

export type Finish = "wood" | "fabric" | "leather" | "metal" | "paint" | "plastic" | "ceramic" | "stone" | "rubber" | "glass" | "screen" | "bark" | "leaf" | "soil" | "light";
const materials = new Map<string, THREE.MeshPhysicalMaterial>();
const maps = new Map<string, { color: THREE.CanvasTexture; bump: THREE.CanvasTexture }>();

/** Local, deterministic PBR textures. No network requests or external asset licences. */
function texture(kind: Finish) {
  if (maps.has(kind)) return maps.get(kind)!;
  const N = 256, canvas = document.createElement("canvas");
  canvas.width = canvas.height = N;
  const ctx = canvas.getContext("2d")!, pixels = ctx.createImageData(N, N);
  let seed = 731;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const noise = random() - 0.5;
    let value = 238 + noise * 14;
    if (kind === "wood" || kind === "bark") {
      const grain = Math.sin(x * 0.43 + Math.sin(y * 0.031) * 1.3 + Math.sin(x * 0.025) * 5);
      value = (kind === "bark" ? 207 : 233) + grain * (kind === "bark" ? 24 : 12) + noise * 14;
    } else if (kind === "fabric") {
      value = 232 + (x % 4 < 2 ? 8 : -8) + (y % 4 < 2 ? 7 : -7) + noise * 9;
    } else if (kind === "leather") {
      value = 232 + noise * 30 + Math.sin(x * 2.2 + y * 1.7) * 4;
    } else if (kind === "stone") {
      value = 236 + noise * 9 - Math.pow(Math.max(0, Math.sin(x * 0.018 + y * 0.045 + Math.sin(y * 0.04))), 24) * 22;
    } else if (kind === "metal") {
      value = 243 + Math.sin(y * 2.1) * 4 + noise * 5;
    } else if (kind === "soil") value = 210 + noise * 65;
    else if (kind === "leaf") value = 230 + Math.sin(x * 0.13 + y * 0.11) * 12 + noise * 4;
    const i = (y * N + x) * 4;
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = Math.max(0, Math.min(255, value));
    pixels.data[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  const color = new THREE.CanvasTexture(canvas), bump = new THREE.CanvasTexture(canvas);
  color.colorSpace = THREE.SRGBColorSpace;
  for (const map of [color, bump]) {
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(kind === "fabric" ? 3 : 1, kind === "fabric" ? 3 : 1);
    map.anisotropy = 4;
  }
  const result = { color, bump };
  maps.set(kind, result);
  return result;
}

/** Shared materials keep detailed furniture inexpensive to render. */
export function finish(kind: Finish, color: string) {
  const key = `${kind}:${color}`;
  if (materials.has(key)) return materials.get(key)!;
  const textured = ["wood", "fabric", "leather", "stone", "bark", "leaf", "soil", "metal"].includes(kind);
  const tex = textured ? texture(kind) : undefined;
  const material = new THREE.MeshPhysicalMaterial({
    color, roughness: 0.56, metalness: 0, envMapIntensity: 0.65,
    map: tex?.color, bumpMap: tex?.bump, bumpScale: kind === "bark" ? 0.025 : kind === "fabric" ? 0.007 : 0.003,
  });
  if (kind === "fabric") Object.assign(material, { roughness: 0.93, sheen: 0.35, sheenRoughness: 0.9, sheenColor: new THREE.Color(color) });
  if (kind === "wood") Object.assign(material, { roughness: 0.48, clearcoat: 0.18, clearcoatRoughness: 0.5 });
  if (kind === "leather") Object.assign(material, { roughness: 0.68, clearcoat: 0.12 });
  if (kind === "metal") Object.assign(material, { metalness: 0.9, roughness: 0.3 });
  if (kind === "paint") Object.assign(material, { metalness: 0.2, roughness: 0.26, clearcoat: 0.85, clearcoatRoughness: 0.15 });
  if (kind === "ceramic") Object.assign(material, { roughness: 0.22, clearcoat: 0.4, clearcoatRoughness: 0.18 });
  if (kind === "stone") Object.assign(material, { roughness: 0.4, clearcoat: 0.12 });
  if (kind === "rubber" || kind === "soil" || kind === "bark") material.roughness = 0.96;
  if (kind === "leaf") Object.assign(material, { roughness: 0.8, side: THREE.DoubleSide });
  if (kind === "glass") Object.assign(material, { roughness: 0.08, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, clearcoat: 1 });
  if (kind === "screen") Object.assign(material, { roughness: 0.18, clearcoat: 0.8 });
  if (kind === "light") Object.assign(material, { roughness: 0.3, emissive: new THREE.Color(color), emissiveIntensity: 0.45 });
  material.name = key;
  materials.set(key, material);
  return material;
}
export const tint = (hex: string, factor: number) => `#${new THREE.Color(hex).multiplyScalar(factor).getHexString()}`;
