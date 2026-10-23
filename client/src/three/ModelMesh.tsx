import { Component, Suspense, useMemo, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { FurnitureItem } from "@shared/types/home";

/** Any failure to fetch or parse a model costs nothing but the procedural fallback. */
class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("Model failed; using the built shape instead.", error instanceof Error ? error.message : error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
export const modelSource = (item: FurnitureItem) => item.modelUrl ?? item.model ?? null;

function Model({ url, item }: { url: string; item: FurnitureItem }) {
  const gltf = useGLTF(url, false, false); // Do not download third-party decoder code.
  const scene = useMemo(() => {
    const root = gltf.scene.clone(true),
      box = new THREE.Box3().setFromObject(root),
      size = box.getSize(new THREE.Vector3());
    // Uniform scale: the model fits inside the catalog box without being distorted.
    const k = Math.min(item.width / (size.x || 1), item.height / (size.y || 1), item.depth / (size.z || 1));
    root.scale.multiplyScalar(k);
    const fitted = new THREE.Box3().setFromObject(root),
      centre = fitted.getCenter(new THREE.Vector3());
    root.position.set(-centre.x, -fitted.min.y, -centre.z);
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    const group = new THREE.Group();
    group.add(root);
    // Lets the browser smoke see which models actually made it into the scene.
    if (import.meta.env.DEV) {
      const w = window as unknown as { __hbModels?: Record<string, number> };
      w.__hbModels = { ...w.__hbModels, [url]: (w.__hbModels?.[url] ?? 0) + 1 };
    }
    return group;
  }, [gltf, url, item.width, item.height, item.depth]);
  return <primitive object={scene} />;
}
export function ModelMesh({ item, fallback }: { item: FurnitureItem; fallback: ReactNode }) {
  let url = modelSource(item);
  const shared = /^\/shared\/([A-Za-z0-9_-]{32})$/.exec(window.location.pathname);
  if (url && /^\/api\/assets\/[A-Za-z0-9_-]{32}\.glb$/.test(url) && shared) url += `?share=${encodeURIComponent(shared[1]!)}`;
  if (!url) return <>{fallback}</>;
  return (
    <ModelBoundary key={url} fallback={fallback}>
      <Suspense fallback={fallback}>
        <Model url={url} item={item} />
      </Suspense>
    </ModelBoundary>
  );
}
