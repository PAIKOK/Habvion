// Phase 16: real models for the most visible pieces, with the built shape as a fallback.
const MODELS = ["car-hatch", "ceiling-fan", "fridge-double", "fridge-single", "motorcycle", "scooter", "sofa-3", "wardrobe-2", "washer-front", "wc"];
const loaded = (page) => page.evaluate(() => Object.keys(window.__hbModels ?? {}));
async function open3D(page, url) {
  await page.goto(url + "/demos/contemporary-courtyard", { waitUntil: "networkidle" });
  await page.getByTestId("viewer").waitFor();
  await page.getByRole("button", { name: "3D" }).click();
  await page.locator('[data-testid="scene-3d"] canvas').waitFor({ timeout: 15000 });
}
export default async function ({ page, url, check }) {
  for (const id of MODELS) {
    const r = await page.request.get(`${url}/models/${id}.glb`);
    const body = r.ok() ? await r.body() : Buffer.alloc(0);
    check(`/models/${id}.glb is served as a glTF binary under 1.5 MB`, body.subarray(0, 4).toString() === "glTF" && body.length < 1.5e6, `${r.status()} ${body.length} B`);
  }
  const licences = await page.request.get(`${url}/models/LICENSES.md`);
  const text = licences.ok() ? await licences.text() : "";
  const rows = text.split("\n").filter((l) => l.includes(".glb |"));
  check("every model has a CC BY 4.0 attribution row", MODELS.every((id) => rows.some((l) => l.includes(`${id}.glb`))) && rows.every((l) => /\| CC BY 4\.0 \|/.test(l) && /sketchfab\.com\/3d-models\//.test(l)), `${rows.length} rows`);

  // The demo in 3D: models load, nothing falls back, nothing throws.
  const warnings = [];
  page.on("console", (m) => m.text().includes("Model failed") && warnings.push(m.text()));
  await open3D(page, url);
  await page.waitForFunction(() => Object.keys(window.__hbModels ?? {}).length >= 5, null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const got = await loaded(page);
  check("model-backed pieces render in the courtyard residence", got.length >= 5, got.join(", "));
  // This demo parks a sedan and an SUV (no model yet), so the two-wheelers are the check.
  check("the parked two-wheelers use models", ["motorcycle", "scooter"].every((id) => got.includes(`/models/${id}.glb`)), got.join(", "));
  check("no model fell back", warnings.length === 0, warnings.join(" | "));
  await page.screenshot({ path: "artifacts/phase-16-orbit.png" });
  await page.getByLabel("Show floors up to").selectOption("0");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "artifacts/phase-16-ground.png" });
  const bar = page.getByRole("toolbar", { name: "3D view" });
  await bar.getByRole("button", { name: "Top" }).click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "artifacts/phase-16-top-ground.png" });
  await page.getByLabel("Show floors up to").selectOption("1");
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "artifacts/phase-16-top-first.png" });

  // A missing model costs nothing but the built shape. R3F reports even a caught render
  // error through window.reportError, so this runs on its own page and its expected
  // "Could not load" reports are counted here rather than as runtime errors.
  const p404 = await page.context().browser().newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: "light" }), thrown = [];
  p404.on("pageerror", (e) => thrown.push(e.message));
  p404.on("console", (m) => m.text().includes("Model failed") && warnings.push(m.text()));
  await p404.route("**/models/*.glb", (route) => route.fulfill({ status: 404, body: "" }));
  warnings.length = 0;
  await open3D(p404, url);
  await p404.waitForTimeout(3000);
  check("with every model 404ing, the fallback is used", warnings.length > 0 && (await loaded(p404)).length === 0, `${warnings.length} warnings`);
  check("the only errors are the expected model 404s", thrown.every((m) => /Could not load \/models\/.+\.glb/.test(m)), thrown.filter((m) => !/Could not load \/models\//.test(m)).join("; "));
  const painted = await p404.locator("canvas").evaluate((c) => {
    const g = c.getContext("webgl2") || c.getContext("webgl"), px = new Uint8Array(4);
    g.readPixels(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1, g.RGBA, g.UNSIGNED_BYTE, px);
    return Array.from(px);
  });
  check("the scene still renders on the fallback", painted.some((v) => v > 0), painted.join(","));
  await p404.screenshot({ path: "artifacts/phase-16-fallback.png" });
  await p404.close();
}
