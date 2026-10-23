import { sampleHouse, dispatch, editor } from "./helpers.mjs";
export default async function ({ page, url, check }) {
  const refused = await sampleHouse(page, url);
  check("sample house builds with no refusals", refused.length === 0, refused.join(" | "));
  await dispatch(page, { type: "compound/set", compound: { height: 5, thickness: 0.75, gate: { side: "north", offset: 9, width: 10, kind: "sliding" }, pedestrianGate: { side: "north", offset: 21, width: 3.5, kind: "pedestrian" } } });
  await page.getByRole("button", { name: "3D", exact: true }).first().click();
  await page.locator('[data-testid="scene-3d"] canvas').waitFor();
  await page.waitForTimeout(2500);
  const shot = async (name) => { await page.waitForTimeout(900); await page.screenshot({ path: `artifacts/phase-10-${name}.png` }); };
  const painted = await page.locator("canvas").evaluate((c) => {
    const g = c.getContext("webgl2") || c.getContext("webgl");
    const px = new Uint8Array(4);
    g.readPixels(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1, g.RGBA, g.UNSIGNED_BYTE, px);
    return Array.from(px);
  });
  check("the canvas renders something", painted.some((v) => v > 0), painted.join(","));
  await shot("orbit");
  const bar = page.getByRole("toolbar", { name: "3D view" });
  await bar.getByRole("button", { name: "Top" }).click();
  check("top view is orthographic", (await page.locator('[data-testid="scene-3d"]').getAttribute("data-view")) === "top");
  await shot("top");
  await bar.getByRole("button", { name: "Front" }).click();
  await shot("front");
  await bar.getByRole("button", { name: "3D" }).click();
  await bar.getByRole("button", { name: "Solid" }).click();
  check("see-through mode toggles", (await page.locator('[data-testid="scene-3d"]').getAttribute("data-xray")) === "true");
  await shot("xray");
  await bar.getByRole("button", { name: "See-through" }).click();
  await page.getByLabel("Show floors up to").selectOption("0");
  check("floor cut applies", (await page.locator('[data-testid="scene-3d"]').getAttribute("data-cut")) === "0");
  await shot("cut-ground");
  await page.getByLabel("Show floors up to").selectOption("1");
  await dispatch(page, { type: "roof/set", roof: { type: "hip", materialId: "clay-tile", pitchDeg: 25, overhangFt: 1.5 } });
  await shot("hip-roof");
}
