import { create } from "zustand";
import type { RoomType } from "@shared/types/home";
export type Tool =
  "select" | "room" | "pan" | "measure" | "door" | "window" | "stair" | "furniture";
type EditorState = {
  tool: Tool;
  floor: number;
  selected: string | null;
  roomType: RoomType;
  snap: boolean;
  panel: "inspector" | "budget" | "issues" | "assistant";
  view: "2d" | "3d";
  paletteId: string | null;
  set: (patch: Partial<Omit<EditorState, "set">>) => void;
};
export const useEditorStore = create<EditorState>((set) => ({
  tool: "select",
  floor: 0,
  selected: null,
  roomType: "bedroom",
  snap: true,
  panel: "inspector",
  view: "2d",
  paletteId: null,
  set: (patch) => set(patch),
}));
