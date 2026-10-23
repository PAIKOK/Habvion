import { dragPlan, designState, signIn } from "./helpers.mjs";
export default async function ({ page, url, check }) {
  await signIn(page, url);
  await page.goto(url + "/start", { waitUntil: "networkidle" });
  await page.getByLabel("Display unit").selectOption("m");
  check(
    "setup displays metric without changing the stored size",
    Math.abs(Number(await page.getByLabel("Plot width").inputValue()) - 9.144) < 0.01,
  );
  await page.getByLabel("Display unit").selectOption("ft");
  await page.getByRole("button", { name: "Create my plot" }).click();
  await page.waitForURL("**/editor/*");
  await page.getByLabel("Room to draw").selectOption("living");
  await page.getByRole("button", { name: "Draw room", exact: true }).click();
  await dragPlan(page, 4, 7, 16, 19);
  check(
    "drag draws a measured room",
    (await page.locator("[data-room-id]").count()) === 1 &&
      (await designState(page)).rooms[0].width === 12,
  );
  await dragPlan(page, 10, 13, 12, 14);
  check("drag moves in plan coordinates", (await designState(page)).rooms[0].x === 6);
  const h = page.locator('[data-resize-handle="se"]');
  const box = await h.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 14, box.y + box.height / 2 + 22, { steps: 5 });
  await page.mouse.up();
  check("resize updates the model", (await designState(page)).rooms[0].width > 12);
  await page.getByLabel("Room width", { exact: true }).fill("50");
  await page.getByLabel("Room width", { exact: true }).press("Enter");
  await page.getByRole("alert").waitFor();
  check("bad inspector edits are refused", (await designState(page)).rooms[0].width < 50);
  await page.getByLabel("Lock room").check();
  await page.getByRole("button", { name: "Delete room", exact: true }).click();
  check("locked room refuses deletion", (await designState(page)).rooms.length === 1);
  await page.getByLabel("Lock room").uncheck();
  const before = await page.locator('[data-testid="plan-canvas"]').getAttribute("viewBox");
  await page.getByRole("button", { name: "Zoom in" }).click();
  check(
    "zoom changes the view, not the model",
    before !== (await page.locator('[data-testid="plan-canvas"]').getAttribute("viewBox")),
  );
  check("dimension lines are visible", (await page.locator("[data-dimension]").count()) >= 2);
  await page.getByRole("button", { name: "Fit plan" }).click();
}
