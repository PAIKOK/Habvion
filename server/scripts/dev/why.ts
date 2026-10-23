import { buildDemo } from "@shared/design/demos";
import { applyAction } from "@shared/design/reducer";
const d = buildDemo("smart-urban-home")!.design;
for (const [x, y, r, id] of [[4.75, 37.99, 180, "counter-4"], [3.75, 37.99, 180, "counter-6"], [1.99, 34, 270, "counter-4"]] as const) {
  const res = applyAction(d, { type: "furniture/add", piece: { id: "c", catalogId: id, roomId: "kit", floor: 0, x, y, rotation: r } });
  console.log(id, x, y, res.applied, res.issues.map((i) => i.message));
}
