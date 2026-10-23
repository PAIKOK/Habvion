import { buildDemo } from "@shared/design/demos";
const id = process.argv[2]!, room = process.argv[3];
const { design } = buildDemo(id)!;
for (const f of design.furniture.filter((f) => !room || f.roomId === room)) console.log(f.roomId, f.catalogId, f.x.toFixed(2), f.y.toFixed(2), f.rotation);
