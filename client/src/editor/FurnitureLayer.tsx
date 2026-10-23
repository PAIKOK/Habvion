import type { PointerEvent as ReactPointerEvent } from "react";
import type { HomeDesign, PlacedFurniture } from "@shared/types/home";
import { itemFor } from "@shared/design/catalog";
import { layerOf } from "@shared/design/furniture";
import { useEditorStore } from "../state/editorStore";
import { FurnitureShape } from "./FurnitureShape";

const ORDER = { rug: 0, drape: 1, floor: 2, canopy: 3, surface: 4, wall: 5, ceiling: 6 };

export function FurnitureLayer({
  design,
  floor,
  preview,
  onPieceDown,
}: {
  design: HomeDesign;
  floor: number;
  preview?: PlacedFurniture | null;
  onPieceDown?: (e: ReactPointerEvent<SVGElement>, p: PlacedFurniture) => void;
}) {
  const selected = useEditorStore((s) => s.selected);
  const pieces = design.furniture
    .filter((p) => p.floor === floor)
    .map((p) => (preview?.id === p.id ? preview : p))
    .map((p) => ({ p, item: itemFor(design, p.catalogId) }))
    .filter((x) => x.item)
    .sort((a, b) => ORDER[layerOf(a.item!)] - ORDER[layerOf(b.item!)]);
  return (
    <g>
      {pieces.map(({ p, item }) => (
        <g
          key={p.id}
          data-piece-id={p.id}
          data-catalog-id={p.catalogId}
          transform={`translate(${p.x} ${p.y}) rotate(${p.rotation})`}
          onPointerDown={(e) => onPieceDown?.(e, p)}
          style={{ cursor: "move" }}
        >
          <FurnitureShape item={item!} />
          {selected === p.id && (
            <rect
              x={-item!.width / 2 - 0.12}
              y={-item!.depth / 2 - 0.12}
              width={item!.width + 0.24}
              height={item!.depth + 0.24}
              fill="none"
              stroke="#b65036"
              strokeWidth=".1"
              strokeDasharray=".3 .15"
            />
          )}
        </g>
      ))}
    </g>
  );
}
