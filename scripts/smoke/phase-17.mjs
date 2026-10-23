import { newPlot, designState, dispatch, editor, signIn } from "./helpers.mjs";

// A 1×1 PNG stands in for the shop's product photo, so no shop is ever contacted.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const SHOP = "https://shop.example/p/rattan-armchair";

export default async function ({ page, url, check }) {
  await newPlot(page, url, { width: 30, length: 50, floors: 1 });
  await dispatch(page, { type: "room/add", room: { id: "liv", name: "Living", type: "living", x: 4, y: 6, width: 14, length: 16, floor: 0 } });
  await dispatch(page, { type: "door/add", door: { id: "d1", roomId: "liv", side: "north", offset: 3, width: 3.5, height: 7, doorType: "panel", swing: "left" } });
  const designId = new URL(page.url()).pathname.split("/").pop();

  // The page read is faked at the browser boundary; everything behind it is the real app.
  await page.route("**/api/imports/preview", async (route) => {
    const { url: asked } = route.request().postDataJSON();
    if (asked !== SHOP) return route.continue();
    await route.fulfill({ json: { status: "ok", draft: { name: "Rattan armchair", imageUrl: "https://cdn.example/armchair.png", price: 24999, currency: "INR", sourceUrl: SHOP } } });
  });
  await page.route("https://cdn.example/**", (route) => route.fulfill({ body: PNG, contentType: "image/png" }));

  await page.getByRole("tab", { name: "Budget" }).click();
  const total = async () => Number(await page.locator("[data-budget-total]").getAttribute("data-budget-total"));
  const before = await total();
  await page.getByRole("button", { name: "Furniture", exact: true }).click();
  await editor(page, { selected: "liv" });

  // An address inside a private network is refused by the real server.
  await page.getByTestId("import-open").click();
  const dialog = page.getByRole("dialog", { name: "Import from a link" });
  await dialog.getByLabel("Product link").fill("http://169.254.169.254/latest/meta-data");
  await dialog.getByRole("button", { name: "Read the page" }).click();
  await dialog.locator(".error-text").waitFor();
  check("a private address is refused", /private network/.test(await dialog.locator(".error-text").innerText()));

  // A readable page: name, photo and price come through, the size never does.
  await dialog.getByLabel("Product link").fill(SHOP);
  await dialog.getByRole("button", { name: "Read the page" }).click();
  await dialog.getByLabel("Item name").waitFor();
  check("the name is read from the page", (await dialog.getByLabel("Item name").inputValue()) === "Rattan armchair");
  check("the price is read from the page", (await dialog.getByLabel("Price").inputValue()) === "24999");
  check("the photo is shown", await dialog.locator("img.import-photo").isVisible());
  check("the size is never guessed", (await dialog.getByLabel("Width").inputValue()) === "" && (await dialog.getByLabel("Height").inputValue()) === "");
  check("it cannot be added without a size", await dialog.getByRole("button", { name: "Add to Living" }).isDisabled());
  await dialog.getByLabel("Kind of item").selectOption({ label: "Armchair" });
  await dialog.getByLabel("Width").fill("76");
  await dialog.getByLabel("Depth").fill("80");
  await dialog.getByLabel("Height").fill("85");
  check("centimetres are shown in feet", (await dialog.innerText()).includes("2.49 × 2.62 × 2.79 ft"));
  const makeModel = dialog.getByLabel(/Make a 3D model from the photo/);
  check("the photo is not sent for a 3D model unless asked", !(await makeModel.isChecked()));
  await makeModel.check();
  await dialog.screenshot({ path: "artifacts/phase-17-dialog.png" });
  await dialog.getByRole("button", { name: "Add to Living" }).click();
  await dialog.waitFor({ state: "detached" });

  let d = await designState(page);
  const item = d.customItems?.[0];
  check("the item is part of the design", !!item && item.id.startsWith("custom-rattan-armchair-") && item.price === 24999 && item.width === 2.49, JSON.stringify(item));
  const piece = d.furniture.find((f) => f.catalogId === item?.id);
  check("it is placed in the living room", piece?.roomId === "liv");
  check("it is drawn on the plan", (await page.locator(`[data-catalog-id="${item?.id}"]`).count()) === 1);
  check("it is listed under Your items", (await page.getByRole("button", { name: /Your items · 1/ }).count()) === 1);
  const added = (await total()) - before;
  check("its price goes into the estimate", Math.abs(added - 24999 * 1.05) <= 1, String(added));

  // The photo becomes a model through the mock provider, and the design points at it.
  await page.waitForFunction((id) => window.__hbDesign.getState().design.customItems?.find((i) => i.id === id)?.modelUrl, item.id, { timeout: 20000 });
  d = await designState(page);
  const modelUrl = d.customItems[0].modelUrl;
  check("a 3D model is made and recorded", d.customItems[0].meshJob?.status === "ready" && /^\/api\/assets\/[\w-]{32}\.glb$/.test(modelUrl), modelUrl);
  await page.context().clearCookies();
  const glb = await page.request.get(url + modelUrl);
  check("the model loads without signing in (share links need it)", glb.ok() && (await glb.body()).subarray(0, 4).toString() === "glTF");
  await signIn(page, url);

  // Typed in by hand, as when a shop refuses us.
  await page.getByTestId("import-open").click();
  await dialog.getByRole("button", { name: "Type it in instead" }).click();
  await dialog.getByLabel("Item name").fill("Grandma's trunk");
  await dialog.getByLabel("Kind of item").selectOption({ label: "Cabinet or sideboard" });
  await dialog.getByRole("button", { name: "ft" }).click();
  await dialog.getByLabel("Width").fill("3");
  await dialog.getByLabel("Depth").fill("1.5");
  await dialog.getByLabel("Height").fill("1.75");
  await dialog.getByRole("button", { name: "Just save it" }).click();
  d = await designState(page);
  check("a hand-typed item is saved without placing it", d.customItems.length === 2 && !d.furniture.some((f) => f.catalogId === d.customItems[1].id));

  // Saved with the design, and back after a reload.
  let stored = null;
  for (let i = 0; i < 30 && stored?.design?.customItems?.length !== 2; i++) {
    await page.waitForTimeout(500);
    const r = await page.request.get(`${url}/api/designs/${designId}`);
    stored = r.ok() ? await r.json() : null;
  }
  check("autosave stores the imported items", stored?.design?.customItems?.length === 2, `${await page.getByTestId("save-status").getAttribute("data-status")}: ${await page.getByTestId("save-status").getAttribute("title")} · stored ${stored?.design?.customItems?.length}`);
  await page.reload({ waitUntil: "networkidle" });
  d = await designState(page);
  check("imported items survive a reload", d.customItems?.length === 2 && d.furniture.some((f) => f.catalogId === item.id));
  await page.getByRole("tab", { name: "Budget" }).click();
  await page.getByText("Furniture and appliances").click();
  check("the estimate itemises it by name after a reload", await page.getByTestId("budget-panel").getByText("Rattan armchair").isVisible());
  await page.screenshot({ path: "artifacts/phase-17-plan.png" });
  const fetched = page.waitForResponse((r) => r.url().endsWith(modelUrl), { timeout: 15000 }).catch(() => null);
  await page.getByRole("button", { name: "3D" }).click();
  await page.locator('[data-testid="scene-3d"] canvas').waitFor({ timeout: 15000 });
  const res = await fetched;
  check("the 3D view loads the generated model", res?.status() === 200);
  await page.getByRole("button", { name: "Top", exact: true }).click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "artifacts/phase-17-3d.png" });
  await page.request.delete(`${url}/api/designs/${designId}`);
}
