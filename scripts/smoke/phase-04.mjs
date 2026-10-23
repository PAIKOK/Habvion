import { newPlot, dragPlan, designState, planPoint } from "./helpers.mjs";
export default async function ({ page, url, check }) {
  await newPlot(page, url);
  await page.getByLabel("Room to draw").selectOption("living");
  await page.getByRole("button", { name: "Draw room", exact: true }).click();
  await dragPlan(page, 4, 7, 16, 19);
  check("wall layer is derived", (await page.locator("[data-derived-wall]").count()) === 4);
  await page.getByRole("button", { name: "Door", exact: true }).click();
  let p = await planPoint(page, 10, 7.1);
  await page.mouse.click(p.x, p.y);
  check("door placed by room side", (await designState(page)).doors[0]?.side === "north");
  check("hinged door has a swing arc", (await page.locator("[data-door-swing]").count()) === 1);
  await page.getByLabel("Opening type").selectOption("sliding");
  check("sliding door has no swing arc", (await page.locator("[data-door-swing]").count()) === 0);
  await page.getByRole("button", { name: "Window", exact: true }).click();
  p = await planPoint(page, 15.9, 13);
  await page.mouse.click(p.x, p.y);
  check("window enters the actual model", (await designState(page)).windows.length === 1);
  await page.getByLabel("Centre offset").fill("1");
  await page.getByLabel("Centre offset").press("Enter");
  await page.getByRole("alert").waitFor();
  check("bad offset is visibly refused", (await designState(page)).windows[0].offset === 6);
}
