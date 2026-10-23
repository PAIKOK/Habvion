import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import * as THREE from "three";
import type { HomeDesign } from "@shared/types/home";
import { EYE, barriers, groundAt, startPosition, surfaces, walk } from "@shared/design/walk";
import { locateWalker, type WalkLocation } from "@shared/design/walkLocation";

/**
 * First-person walk: WASD on the plan, mouse to look. Barriers only stop you when
 * they rise above a step and below your head, so you climb stairs, step onto the
 * plinth, walk through doorways and cannot walk through walls, parapets or sofas.
 */
export function WalkControls({ design, onLocationChange }: { design: HomeDesign; onLocationChange: (location: WalkLocation) => void }) {
  const camera = useThree((s) => s.camera),
    gl = useThree((s) => s.gl),
    walls = useMemo(() => barriers(design), [design]),
    floors = useMemo(() => surfaces(design), [design]),
    keys = useRef(new Set<string>()),
    reported = useRef<{ at: number; x: number; y: number; feet: number; heading: number } | null>(null),
    state = useRef<{ x: number; y: number; feet: number } | null>(null);
  useEffect(() => { reported.current = null; }, [design]);
  useEffect(() => {
    const start = startPosition(design);
    state.current = { x: start.p.x, y: start.p.y, feet: groundAt(floors, start.p, 0) };
    camera.position.set(start.p.x, state.current.feet + EYE, start.p.y);
    camera.rotation.set(0, (-start.heading * Math.PI) / 180, 0, "YXZ");
    (camera as THREE.PerspectiveCamera).fov = 70;
    camera.updateProjectionMatrix();
    // Only on entering walk mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
        if (e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))) return;
        if (/^(Key[WASD]|Arrow(Up|Down|Left|Right)|Shift(Left|Right))$/.test(e.code)) {
          e.preventDefault();
          keys.current.add(e.code);
        }
      },
      up = (e: KeyboardEvent) => keys.current.delete(e.code),
      blur = () => keys.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);
  useFrame((_, dt) => {
    const s = state.current;
    if (!s) return;
    const k = keys.current,
      step = Math.min(dt, 0.05) * (k.has("ShiftLeft") || k.has("ShiftRight") ? 9 : 4.5),
      forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3(-forward.z, 0, forward.x),
      move = new THREE.Vector3();
    if (k.has("KeyW") || k.has("ArrowUp")) move.add(forward);
    if (k.has("KeyS") || k.has("ArrowDown")) move.sub(forward);
    if (k.has("KeyD") || k.has("ArrowRight")) move.add(right);
    if (k.has("KeyA") || k.has("ArrowLeft")) move.sub(right);
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(step);
      const p = walk(walls, { x: s.x, y: s.y }, { x: move.x, y: move.z }, s.feet);
      s.x = p.x;
      s.y = p.y;
    }
    const ground = groundAt(floors, { x: s.x, y: s.y }, s.feet);
    // Step up at once; fall gently.
    s.feet = ground >= s.feet ? ground : Math.max(ground, s.feet - Math.min(dt, 0.05) * 18);
    camera.position.set(s.x, s.feet + EYE, s.y);
    // Ten updates per second are enough for the HUD; don't re-render it while idle.
    const at = performance.now(), previous = reported.current;
    if (!previous || at - previous.at >= 100) {
      const heading = (Math.atan2(forward.x, -forward.z) * 180 / Math.PI + 360) % 360;
      if (!previous || Math.hypot(s.x - previous.x, s.y - previous.y) > 0.01 || Math.abs(s.feet - previous.feet) > 0.01 || Math.abs(heading - previous.heading) > 0.5) {
        onLocationChange(locateWalker(design, { ...s, heading }));
        reported.current = { ...s, heading, at };
      } else reported.current = { ...previous, at };
    }
    if (import.meta.env.DEV) (window as unknown as { __hbWalk: unknown }).__hbWalk = { ...s };
  });
  return <PointerLockControls domElement={gl.domElement} selector='.scene-wrap[data-view="walk"] canvas' />;
}
