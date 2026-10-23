export async function planPoint(page, x, y) {
  return page.locator('[data-testid="plan-canvas"]').evaluate(
    (svg, [x, y]) => {
      const p = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM());
      return { x: p.x, y: p.y };
    },
    [x, y],
  );
}
export async function dragPlan(page, x, y, toX, toY) {
  const a = await planPoint(page, x, y),
    b = await planPoint(page, toX, toY);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(100);
}
export async function designState(page) {
  await page.waitForFunction(() => window.__hbDesign);
  return page.evaluate(() => window.__hbDesign.getState().design);
}
export async function dispatch(page, action) {
  await page.waitForFunction(() => window.__hbDesign);
  return page.evaluate((action) => window.__hbDesign.getState().dispatch(action), action);
}
/** Sign the browser context in with the smoke account (created on first use). */
export const SMOKE_USER = { name: "Smoke Tester", email: "smoke@homebuilder.test", password: "smoke-test-password", consent: true };
export async function signIn(page, url) {
  for (let attempt = 0; attempt < 12; attempt++) {
    let r = await page.request.post(`${url}/api/auth/login`, { data: { email: SMOKE_USER.email, password: SMOKE_USER.password } });
    if (r.status() === 401) r = await page.request.post(`${url}/api/auth/signup`, { data: SMOKE_USER });
    if (r.ok()) return;
    if (r.status() !== 429) throw new Error(`smoke sign-in failed: ${r.status()} ${await r.text()}`);
    await page.waitForTimeout(6000); // the auth routes are rate limited per minute
  }
  throw new Error("smoke sign-in stayed rate limited");
}
export async function newPlot(page, url, input = { width: 30, length: 50, floors: 2 }) {
  await signIn(page, url);
  await page.goto(url + "/start", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Create my plot" }).click();
  await page.waitForURL("**/editor/*");
  // Keep the saved design's id so autosave keeps writing to it.
  await dispatch(page, { type: "design/new", input: { ...input, id: new URL(page.url()).pathname.split("/").pop() } });
}
export async function editor(page, patch) {
  await page.waitForFunction(() => window.__hbEditor);
  return page.evaluate((patch) => window.__hbEditor.getState().set(patch), patch);
}
/** A small two-storey house, built through dispatch exactly as a user would. */
export async function sampleHouse(page, url) {
  await newPlot(page, url, { width: 30, length: 50, floors: 2 });
  const A = [
    ["room/add", { room: { id: "liv", name: "Living", type: "living", x: 3, y: 6, width: 14, length: 14, floor: 0 } }],
    ["room/add", { room: { id: "kit", name: "Kitchen", type: "kitchen", x: 17, y: 6, width: 10, length: 10, floor: 0 } }],
    ["room/add", { room: { id: "core", name: "Stairs", type: "staircase", x: 17, y: 16, width: 10, length: 13, floor: 0 } }],
    ["room/add", { room: { id: "bed", name: "Bedroom", type: "bedroom", x: 3, y: 20, width: 14, length: 12, floor: 0 } }],
    ["room/add", { room: { id: "gar", name: "Garden", type: "garden", x: 3, y: 34, width: 24, length: 13, floor: 0 } }],
    ["room/add", { room: { id: "mb", name: "Master bedroom", type: "master-bedroom", x: 3, y: 6, width: 14, length: 14, floor: 1 } }],
    ["room/add", { room: { id: "lob", name: "Lobby", type: "hall", x: 17, y: 16, width: 10, length: 13, floor: 1 } }],
    ["room/add", { room: { id: "ter", name: "Terrace", type: "terrace", x: 3, y: 20, width: 14, length: 12, floor: 1 } }],
    ["door/add", { door: { id: "d1", roomId: "liv", side: "north", offset: 3, width: 3.5, height: 7, doorType: "panel", swing: "left" } }],
    ["door/add", { door: { id: "d2", roomId: "liv", side: "east", offset: 11, width: 3, height: 7, doorType: "flush", swing: "right" } }],
    ["door/add", { door: { id: "d3", roomId: "bed", side: "east", offset: 4, width: 3, height: 7, doorType: "flush", swing: "left" } }],
    ["door/add", { door: { id: "d4", roomId: "kit", side: "south", offset: 5, width: 3, height: 7, doorType: "sliding", swing: "left" } }],
    ["door/add", { door: { id: "d5", roomId: "lob", side: "west", offset: 4, width: 3, height: 7, doorType: "panel", swing: "left" } }],
    ["door/add", { door: { id: "d6", roomId: "lob", side: "west", offset: 10, width: 5, height: 7, doorType: "french", swing: "left" } }],
    ["window/add", { window: { id: "w1", roomId: "liv", side: "west", offset: 7, width: 5, height: 4.5, windowType: "casement", sill: 2.5 } }],
    ["window/add", { window: { id: "w2", roomId: "kit", side: "north", offset: 5, width: 4, height: 3.5, windowType: "sliding", sill: 3.5 } }],
    ["window/add", { window: { id: "w3", roomId: "bed", side: "south", offset: 7, width: 6, height: 4.5, windowType: "casement", sill: 2.5 } }],
    ["window/add", { window: { id: "w4", roomId: "mb", side: "north", offset: 7, width: 6, height: 4.5, windowType: "bay", sill: 2.5 } }],
    ["stair/add", { stair: { id: "st", x: 18.5, y: 17, width: 7, length: 11, fromFloor: 0, toFloor: 1, direction: "north", stairType: "dog-legged", turn: "left" } }],
    ["furniture/add", { piece: { id: "f1", catalogId: "sofa-3", roomId: "liv", x: 9, y: 18.4, rotation: 180, floor: 0 } }],
    ["furniture/add", { piece: { id: "f2", catalogId: "coffee-table", roomId: "liv", x: 9, y: 14.5, rotation: 0, floor: 0 } }],
    ["furniture/add", { piece: { id: "f3", catalogId: "tv-unit", roomId: "liv", x: 12.5, y: 6.8, rotation: 0, floor: 0 } }],
    ["furniture/add", { piece: { id: "f4", catalogId: "bed-queen", roomId: "bed", x: 8, y: 25.5, rotation: 270, floor: 0 } }],
    ["furniture/add", { piece: { id: "f5", catalogId: "counter-8", roomId: "kit", x: 22, y: 7.01, rotation: 0, floor: 0 } }],
    ["furniture/add", { piece: { id: "f6", catalogId: "shade-tree", roomId: "gar", x: 8, y: 40, rotation: 0, floor: 0 } }],
    ["furniture/add", { piece: { id: "f7", catalogId: "bed-king", roomId: "mb", x: 10, y: 15, rotation: 180, floor: 1 } }],
    ["furniture/add", { piece: { id: "f8", catalogId: "garden-swing", roomId: "gar", x: 21, y: 41, rotation: 0, floor: 0 } }],
    ["roof/set", { roof: { type: "flat", materialId: "rcc", pitchDeg: 22, overhangFt: 1 } }],
    ["paint/set", { target: { kind: "room", roomId: "liv" }, colorHex: "#b7c4a4" }],
    ["paint/set", { target: { kind: "wall", roomId: "mb", side: "north" }, colorHex: "#c8714f" }],
  ];
  const refused = [];
  for (const [type, body] of A) {
    const r = await dispatch(page, { type, ...body });
    if (!r?.applied) refused.push(`${type}: ${r?.issues?.map((i) => i.message).join("; ")}`);
  }
  return refused;
}
