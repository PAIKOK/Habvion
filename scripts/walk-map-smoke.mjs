// User-visible navigation checks; works on dev AND production without window.__hb* hooks.
import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
const url = process.env.HB_SMOKE_URL || "http://127.0.0.1:5173";
await mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: "light" });
const errors = [];
page.on("pageerror", e => errors.push(e.message));
let failures = 0;
function check(label, ok) { if (!ok) failures++; console.log(`${ok ? "PASS" : "FAIL"} ${label}`); }
try {
  await page.goto(url + "/demos/garden-bungalow", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Garden Bungalow", exact: true }).waitFor();
  await page.getByRole("button", { name: "3D", exact: true }).click();
  const bar = page.getByRole("toolbar", { name: "3D view" });
  await bar.getByRole("button", { name: "Walk", exact: true }).click();
  const map = page.getByTestId("walk-minimap"), marker = page.getByTestId("walk-map-player"), room = page.getByTestId("walk-current-room");
  await marker.waitFor();
  check("the live location starts on the entrance porch", (await room.innerText()).includes("Entrance porch"));
  const before = Number(await marker.getAttribute("data-y"));
  try {
    await page.keyboard.down("KeyW");
    await page.waitForFunction(() => document.querySelector('[data-testid="walk-current-room"]')?.getAttribute("data-room-id") === "liv", null, { timeout: 10000 });
  } finally { await page.keyboard.up("KeyW"); }
  check("walking changes the location to Living & dining", (await room.innerText()).includes("Living & dining"));
  check("the mini-map marker follows the real movement", Number(await marker.getAttribute("data-y")) > before + 2);
  check("the active room is highlighted", (await map.locator('rect[data-room-id="liv"][data-current="true"]').count()) === 1);

  // Only the scene canvas, not map/toolbar buttons, may capture the mouse.
  const heading = Number(await marker.getAttribute("data-heading"));
  const canvas = page.locator('[data-testid="scene-3d"] canvas'), bounds = await canvas.boundingBox();
  await page.mouse.click(bounds.x + bounds.width * 0.4, bounds.y + bounds.height * 0.4);
  await page.waitForFunction(() => document.pointerLockElement?.tagName === "CANVAS");
  await page.mouse.move(bounds.x + bounds.width * 0.4 + 140, bounds.y + bounds.height * 0.4);
  await page.waitForFunction(old => {
    const h = Number(document.querySelector('[data-testid="walk-map-player"]')?.getAttribute("data-heading"));
    return Math.abs(h - old) > 5;
  }, heading);
  check("looking around rotates the map direction marker", Math.abs(Number(await marker.getAttribute("data-heading")) - heading) > 5);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.pointerLockElement);
  await map.getByRole("button", { name: "Hide mini-map" }).click();
  check("collapsing the map keeps the room label", await room.isVisible() && (await page.getByTestId("walk-map-plan").count()) === 0);
  check("map buttons leave the mouse unlocked", await page.evaluate(() => !document.pointerLockElement));
  await map.getByRole("button", { name: "Show mini-map" }).click();
  check("the map reopens normally", await page.getByTestId("walk-map-plan").isVisible());
  await page.screenshot({ path: "artifacts/walk-minimap-desktop.png" });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.screenshot({ path: "artifacts/walk-minimap-dark.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  const b = await map.boundingBox();
  check("the mini-map fits a narrow phone screen", b.x >= 0 && b.x + b.width <= 390 && b.height < 330);
  await page.screenshot({ path: "artifacts/walk-minimap-mobile-dark.png" });
  await bar.getByRole("button", { name: "3D", exact: true }).click();
  check("leaving walk mode removes the mini-map", (await page.getByTestId("walk-minimap").count()) === 0);
  check("there are no browser runtime errors", errors.length === 0);
} catch (e) { failures++; console.log("FAIL navigation smoke", String(e)); }
finally { await browser.close(); }
console.log(`Walking mini-map: ${failures} failures.`);
process.exitCode = failures ? 1 : 0;
