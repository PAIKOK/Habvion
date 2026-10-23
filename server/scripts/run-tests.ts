import { readdir } from "node:fs/promises";
import { finish } from "./check.js";
const dir = new URL("./tests/", import.meta.url);
for (const name of (await readdir(dir)).filter(x => x.endsWith(".test.ts")).sort()) {
  console.log(`\n=== ${name} ===`);
  await import(new URL(name, dir).href);
}
finish();
