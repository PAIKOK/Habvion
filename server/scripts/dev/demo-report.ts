// Developer aid: build one demo and print what refused, what was skipped and audit errors.
import { allIssues } from "@shared/design/audit";
import { DEMOS } from "@shared/design/demos";
const which = process.argv[2];
for (const demo of DEMOS.filter((d) => !which || d.id.includes(which))) {
  const { design, refusals, skipped } = demo.build();
  const issues = allIssues(design);
  console.log(`\n### ${demo.title}: ${design.rooms.length} rooms, ${design.furniture.length} pieces`);
  for (const r of refusals) console.log("REFUSED", r);
  for (const s of skipped) console.log("skipped", s);
  for (const i of issues) console.log(i.level === "error" ? "ERROR  " : "warn   ", `[F${i.floor ?? "-"}] ${i.code}: ${i.message}`);
}
