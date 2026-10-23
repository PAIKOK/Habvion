import { newPlot, designState, dispatch } from "./helpers.mjs";
export default async function ({ page, url, check }) {
  await newPlot(page, url, { width: 30, length: 50, floors: 1 });
  await page.getByRole("tab", { name: "Budget" }).click();
  check("empty plot shows ₹0", (await page.locator("[data-budget-total]").getAttribute("data-budget-total")) === "0");
  await dispatch(page, { type: "room/add", room: { id: "l", name: "Living", type: "living", x: 4, y: 6, width: 12, length: 15, floor: 0 } });
  const t1 = Number(await page.locator("[data-budget-total]").getAttribute("data-budget-total"));
  check("budget updates live with a room", t1 > 300000);
  check("rupees use Indian grouping", /₹\d{1,2},\d{2},\d{3}/.test(await page.locator(".budget-total").innerText()));
  await dispatch(page, { type: "furniture/add", piece: { id: "s", catalogId: "sofa-3", roomId: "l", x: 10, y: 7.6, rotation: 0, floor: 0 } });
  const t2 = Number(await page.locator("[data-budget-total]").getAttribute("data-budget-total"));
  check("a sofa adds its price plus contingency", t2 - t1 === Math.round(45000 * 1.05) || Math.abs(t2 - t1 - 47250) <= 1, String(t2 - t1));
  await page.getByText("Furniture and appliances").click();
  check("line items are itemised", await page.getByText("Three-seater sofa").isVisible());
  await page.screenshot({ path: "artifacts/phase-08-budget.png" });
}
