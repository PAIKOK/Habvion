import { DEMOS } from "@shared/design/demos";
for (const d of DEMOS) { const t = performance.now(); d.build(); console.log(d.id, Math.round(performance.now() - t), "ms"); }
