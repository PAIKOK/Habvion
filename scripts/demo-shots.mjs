// Screenshot a demo house: each floor in 2D, and the 3D orbit view.
import { chromium } from "playwright-core";
const url = process.env.HB_SMOKE_URL || "http://127.0.0.1:5173";
const id = process.argv[2];
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on("pageerror", (e) => console.log("BROWSER ERROR", e.message));
await page.goto(`${url}/demos/${id}`, { waitUntil: "networkidle" });
const tabs = page.getByRole("tablist", { name: "Floors" }).getByRole("tab");
const n = await tabs.count();
for (let i = 0; i < n; i++) {
  await tabs.nth(i).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `artifacts/demo-${id}-f${i}.png` });
}
await page.getByRole("group", { name: "View" }).getByRole("button", { name: "3D" }).click();
await page.locator('[data-testid="scene-3d"] canvas').waitFor({ timeout: 20000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: `artifacts/demo-${id}-3d.png` });
console.log(`shots for ${id}: ${n} floors + 3d`);
await browser.close();
