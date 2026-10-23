import { newPlot, designState, dispatch, editor } from "./helpers.mjs";
export default async function ({ page, url, check }) {
  await newPlot(page, url, { width: 30, length: 50, floors: 1 });
  await dispatch(page, { type: "room/add", room: { id: "liv", name: "Living", type: "living", x: 4, y: 6, width: 14, length: 16, floor: 0 } });
  await editor(page, { selected: "liv" });
  await page.getByLabel("Flooring").selectOption("marble");
  check("flooring choice enters the model", (await designState(page)).flooring.liv === "marble");
  await page.getByRole("radio", { name: "Wall paint: Sage" }).click();
  check("room coat enters the model", (await designState(page)).paint[0]?.colorHex === "#b7c4a4");
  await page.locator(".accent-walls summary").click();
  await page.getByRole("radio", { name: "North wall: Terracotta" }).click();
  check("accent wall enters the model", (await designState(page)).paint.length === 2);
  await editor(page, { selected: null });
  await page.getByLabel("Roof type").selectOption("gable");
  let d = await designState(page);
  check("gable roof defaults to clay tile", d.roof?.type === "gable" && d.roof.materialId === "clay-tile");
  await page.getByText("Boundary wall with gates").click();
  d = await designState(page);
  check("compound wall with two gates", !!d.compound?.pedestrianGate);
  check("compound drawn with gate gaps", (await page.locator("[data-gate]").count()) === 2);
  await page.getByLabel("Main gate width").fill("40");
  await page.getByLabel("Main gate width").press("Enter");
  check("an impossible gate is refused", (await designState(page)).compound.gate.width === 10 && (await page.getByRole("alert").count()) === 1);
  await page.getByText("Security: CCTV").click();
  check("security system toggles", (await designState(page)).systems.security === true);
  if (await page.getByRole("button", { name: "Dismiss" }).count()) await page.getByRole("button", { name: "Dismiss" }).click();
  await page.screenshot({ path: "artifacts/phase-07-site.png" });
}
