import { sampleHouse, designState } from "./helpers.mjs";
export default async function ({ page, url, check }) {
  const refused = await sampleHouse(page, url);
  check("sample house builds with no refusals", refused.length === 0, refused.join(" | "));
  const before = await designState(page);
  await page.getByRole("tab", { name: "Assistant" }).click();
  const panel = page.getByTestId("assistant");
  check("assistant panel opens with examples", await panel.getByRole("button", { name: "Furnish the living room" }).isVisible());
  const box = panel.getByLabel("Message the assistant");
  await box.fill("Furnish the bedroom, paint the kitchen sage and add a window to the bedroom");
  await box.press("Enter");
  await panel.locator(".outcomes li").first().waitFor({ timeout: 15000 });
  const after = await designState(page);
  const applied = await panel.locator('.outcomes li[data-applied="true"]').count();
  check("three changes reported applied", applied === 3, await panel.locator(".outcomes").innerText());
  check("bedroom gained furniture", after.furniture.filter((f) => f.roomId === "bed").length > before.furniture.filter((f) => f.roomId === "bed").length);
  check("kitchen paint recorded", after.paint.some((p) => p.target.roomId === "kit" && p.colorHex === "#b7c4a4"));
  check("bedroom gained a window", after.windows.length === before.windows.length + 1);
  await page.screenshot({ path: "artifacts/phase-12-applied.png" });

  await box.fill("Add a ballroom with a spaceship");
  await box.press("Enter");
  await panel.locator(".turn-assistant").nth(1).waitFor();
  await page.waitForTimeout(300);
  check("an impossible request changes nothing", JSON.stringify((await designState(page)).rooms) === JSON.stringify(after.rooms));

  // The whole plan is one undo step.
  await page.locator(".plan-canvas").click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.keyboard.press("Control+z");
  const undone = await designState(page);
  check("one undo reverts the whole plan", undone.furniture.length === before.furniture.length && undone.windows.length === before.windows.length && undone.paint.length === before.paint.length);

  const r = await page.request.post(`${url}/api/ai/plan`, { data: { message: "hi" } });
  check("API refuses a request without a design", r.status() === 400);
}
