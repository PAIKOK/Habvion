import { SMOKE_USER } from "./helpers.mjs";
const TITLES = ["Modern Family Villa", "Smart Urban Home", "Luxury Courtyard Villa", "Indian Standard Home", "Contemporary Courtyard Residence", "Garden Bungalow"];
export default async function ({ page, url, check }) {
  // Landing cards: a live plan, facts counted from the design, two actions each.
  await page.goto(url + "/#demo-homes", { waitUntil: "networkidle" });
  const cards = page.getByTestId("demo-card");
  await cards.first().waitFor({ timeout: 15000 });
  check("six demo cards", (await cards.count()) === 6);
  const text = await page.locator("#demo-homes").innerText();
  check("every demo is named", TITLES.every((t) => text.includes(t)));
  check("cards show plot, built-up area and an estimate", /40×60 ft/.test(text) && /sq ft/.test(text) && /₹[\d,]+/.test(text));
  check("the courtyard residence parks 2 cars + 2 two-wheelers", text.includes("2 cars + 2 two-wheelers"));
  check("each card has a plan preview", (await page.locator(".demo-card svg.demo-thumb rect").count()) > 50);
  check("each card has View and Customize", (await page.getByRole("link", { name: "View House" }).count()) === 6 && (await page.getByRole("link", { name: "Customize This House" }).count()) === 6);
  await page.locator("#demo-homes").screenshot({ path: "artifacts/phase-15-cards.png" });

  // The sixth house uses the same public viewer and renders both plan and 3D.
  await page.getByRole("link", { name: "View Garden Bungalow" }).click();
  await page.waitForURL("**/demos/garden-bungalow");
  await page.getByTestId("viewer").waitFor();
  check("Garden Bungalow opens as a single-floor public demo", await page.getByRole("heading", { name: "Garden Bungalow", exact: true }).isVisible() && (await page.getByRole("tab").count()) === 1);
  await page.screenshot({ path: "artifacts/demo-garden-bungalow-plan.png" });
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await page.locator('[data-testid="scene-3d"] canvas').waitFor({ timeout: 15000 });
  await page.waitForTimeout(1800);
  check("Garden Bungalow has a 3D viewer", await page.getByTestId("scene-3d").isVisible());
  await page.screenshot({ path: "artifacts/demo-garden-bungalow-3d.png" });
  await page.getByRole("toolbar", { name: "3D view" }).getByRole("button", { name: "Walk" }).click();
  await page.getByTestId("walk-map-player").waitFor();
  check("Garden Bungalow starts walking on its entrance porch", /Entrance porch/.test(await page.getByTestId("walk-current-room").innerText()));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const miniBounds = await page.getByTestId("walk-minimap").boundingBox();
  check("the walking mini-map fits a phone screen", !!miniBounds && miniBounds.x >= 0 && miniBounds.x + miniBounds.width <= 390 && miniBounds.height < 330);
  await page.screenshot({ path: "artifacts/walk-minimap-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(url + "/#demo-homes", { waitUntil: "networkidle" });
  await page.getByTestId("demo-card").first().waitFor({ timeout: 15000 });

  // The viewer: public, read-only, every floor.
  await page.getByRole("link", { name: "View Contemporary Courtyard Residence" }).click();
  await page.waitForURL("**/demos/contemporary-courtyard");
  const viewer = page.getByTestId("viewer");
  await viewer.waitFor();
  check("the viewer is read-only", (await viewer.innerText()).includes("READ-ONLY") && (await page.getByRole("button", { name: "Draw room" }).count()) === 0);
  check("the viewer has three floor tabs", (await page.getByRole("tab").count()) === 3);
  await page.screenshot({ path: "artifacts/phase-15-viewer.png" });
  await page.getByRole("button", { name: "3D" }).click();
  await page.locator('[data-testid="scene-3d"] canvas').waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "artifacts/phase-15-viewer-3d.png" });
  const missing = await page.request.get(`${url}/api/demos/not-a-house`);
  check("an unknown demo is a 404", missing.status() === 404);

  // Customize while signed out: sign in, then the copy happens by itself.
  await page.context().clearCookies();
  await page.goto(url + "/#demo-homes", { waitUntil: "networkidle" });
  await page.getByTestId("demo-card").filter({ hasText: "Indian Standard Home" }).getByRole("link", { name: "Customize This House" }).click();
  await page.waitForURL("**/signup?next=*");
  check("signed-out customize asks for an account", new URL(page.url()).searchParams.get("next") === "/demos/indian-standard-home?customize=1");
  const login = await page.request.post(`${url}/api/auth/login`, { data: { email: SMOKE_USER.email, password: SMOKE_USER.password } });
  if (login.status() === 401) await page.request.post(`${url}/api/auth/signup`, { data: SMOKE_USER });
  await page.goto(url + "/demos/indian-standard-home?customize=1", { waitUntil: "networkidle" });
  await page.waitForURL("**/editor/*", { timeout: 15000 });
  const id = new URL(page.url()).pathname.split("/").pop();
  const saved = await page.request.get(`${url}/api/designs/${id}`);
  const body = saved.ok() ? await saved.json() : null;
  check("the copy is saved to the account", !!body && body.design.name === "My Indian Standard Home", body?.design?.name);
  check("the copy keeps every room", body?.design?.rooms?.length === 9);
  await page.screenshot({ path: "artifacts/phase-15-customized.png" });
  await page.request.delete(`${url}/api/designs/${id}`);

  // The new demo can be copied into a real, editable saved design too.
  const original = await (await page.request.get(`${url}/api/demos/garden-bungalow`)).json();
  await page.goto(url + "/demos/garden-bungalow?customize=1", { waitUntil: "networkidle" });
  await page.waitForURL("**/editor/*", { timeout: 15000 });
  const bungalowId = new URL(page.url()).pathname.split("/").pop();
  try {
    const copied = await page.request.get(`${url}/api/designs/${bungalowId}`);
    const copy = copied.ok() ? (await copied.json()).design : null;
    check("Garden Bungalow customization saves a separate complete copy", !!copy && copy.name === "My Garden Bungalow" && copy.id !== original.design.id && copy.rooms.length === original.design.rooms.length && copy.furniture.length === original.design.furniture.length);
    await page.screenshot({ path: "artifacts/demo-garden-bungalow-customized.png" });
  } finally {
    await page.request.delete(`${url}/api/designs/${bungalowId}`);
  }
}
