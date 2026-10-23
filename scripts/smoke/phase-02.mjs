import { newPlot, designState, dispatch } from "./helpers.mjs";
export default async function ({ page, url, check }) {
  await newPlot(page, url, { width: 30, length: 50, floors: 2 });
  const room = { id: "liv", name: "Living room", type: "living", x: 5, y: 6, width: 12, length: 12, floor: 0 };
  const ok = await dispatch(page, { type: "room/add", room });
  check("a valid action updates the one design", ok.applied && (await designState(page)).rooms.length === 1);
  const refused = await dispatch(page, { type: "room/add", room: { ...room, id: "dup", x: 6 } });
  check("an overlapping room is refused and changes nothing", !refused.applied && (await designState(page)).rooms.length === 1);
  await page.getByRole("button", { name: "Undo" }).click();
  check("undo removes it", (await designState(page)).rooms.length === 0);
  await page.getByRole("button", { name: "Redo" }).click();
  check("redo brings it back", (await designState(page)).rooms.length === 1);
}
