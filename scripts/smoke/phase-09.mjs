import { newPlot, designState, dispatch } from "./helpers.mjs";
export default async function ({ page, url, check }) {
  await newPlot(page, url, { width: 30, length: 50, floors: 1 });
  await dispatch(page, { type: "room/add", room: { id: "liv", name: "Living", type: "living", x: 4, y: 6, width: 14, length: 14, floor: 0 } });
  await dispatch(page, { type: "room/add", room: { id: "bed", name: "Bedroom", type: "bedroom", x: 4, y: 20, width: 12, length: 12, floor: 0 } });
  await page.getByRole("tab", { name: /Issues/ }).click();
  check("issues tab shows a live error badge", Number(await page.locator(".tab-badge").innerText()) > 0);
  check("missing entrance is reported", (await page.locator('[data-issue-code="access/no-entrance"]').count()) === 1);
  await page.locator('[data-issue-code="room/no-hall-access"]').first().click();
  check("clicking an issue selects the room", ["liv", "bed"].includes(await page.evaluate(() => window.__hbEditor.getState().selected)));
  await page.getByRole("tab", { name: /Issues/ }).click();
  await dispatch(page, { type: "door/add", door: { id: "front", roomId: "liv", side: "north", offset: 7, width: 3.5, height: 7, doorType: "panel", swing: "left" } });
  await dispatch(page, { type: "door/add", door: { id: "bd", roomId: "bed", side: "north", offset: 6, width: 3, height: 7, doorType: "panel", swing: "left" } });
  check("adding doors clears reachability", (await page.locator('[data-issue-code="room/no-hall-access"]').count()) === 0);
  check("missing kitchen is reported", (await page.locator('[data-issue-code="services/no-kitchen"]').count()) === 1);
  await page.screenshot({ path: "artifacts/phase-09-issues.png" });
}
