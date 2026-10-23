import { create } from "zustand";
import { createDesign, type NewDesignInput } from "@shared/design/createDesign";
import { applyAction } from "@shared/design/reducer";
import { validateDesign } from "@shared/design/validation";
import type { ApplyResult, DesignAction, Issue } from "@shared/design/actions";
import type { HomeDesign } from "@shared/types/home";
export type StoreAction =
  | DesignAction
  | { type: "design/new"; input: NewDesignInput }
  | { type: "design/load"; design: HomeDesign }
  | { type: "history/undo" }
  | { type: "history/redo" }
  /** Replace the design with one built elsewhere (e.g. an assistant plan) as one undo step. */
  | { type: "history/commit"; design: HomeDesign }
  | { type: "session/clear" };
type DesignState = {
  design: HomeDesign | null;
  past: HomeDesign[];
  future: HomeDesign[];
  issues: Issue[];
  dispatch: (action: StoreAction) => ApplyResult | null;
};
export const useDesignStore = create<DesignState>((set, get) => ({
  design: null,
  past: [],
  future: [],
  issues: [],
  dispatch: (action) => {
    const current = get();
    let design = current.design;
    if (action.type === "session/clear") {
      set({ design: null, past: [], future: [], issues: [] });
      return null;
    }
    if (action.type === "design/new" || action.type === "design/load") {
      try {
        design = action.type === "design/new" ? createDesign(action.input) : action.design;
        const v = validateDesign(design);
        if (!v.ok) {
          set({ issues: v.issues });
          return current.design ? { ...v, applied: false, design: current.design } : null;
        }
        set({ design, past: [], future: [], issues: [] });
        return { ...v, applied: true, design };
      } catch (e) {
        set({
          issues: [
            {
              level: "error",
              code: "design/invalid",
              message: e instanceof Error ? e.message : "Invalid plot",
            },
          ],
        });
        return null;
      }
    }
    if (!design) return null;
    if (action.type === "history/undo" || action.type === "history/redo") {
      const undo = action.type === "history/undo",
        stack = undo ? current.past : current.future,
        target = stack.at(-1);
      if (!target) return null;
      const v = validateDesign(target);
      if (!v.ok) {
        set({ issues: v.issues });
        return { ...v, applied: false, design };
      }
      set({
        design: { ...target, revision: design.revision + 1 },
        past: undo ? current.past.slice(0, -1) : [...current.past, design].slice(-50),
        future: undo ? [...current.future, design].slice(-50) : current.future.slice(0, -1),
        issues: [],
      });
      return { ...v, applied: true, design: get().design! };
    }
    if (action.type === "history/commit") {
      const v = validateDesign(action.design);
      if (!v.ok) {
        set({ issues: v.issues });
        return { ...v, applied: false, design };
      }
      const next = { ...action.design, revision: design.revision + 1 };
      set({ design: next, past: [...current.past, design].slice(-50), future: [], issues: [] });
      return { ...v, applied: true, design: next };
    }
    const result = applyAction(design, action);
    set(
      result.applied
        ? {
            design: result.design,
            past: [...current.past, design].slice(-50),
            future: [],
            issues: result.issues.filter((i) => touches(action, i)),
          }
        : { issues: result.issues },
    );
    return result;
  },
}));

/** Whole-design warnings belong in the issues panel; the toast shows only this edit's. */
function touches(action: DesignAction, i: Issue) {
  const a = action as Record<string, unknown>,
    nested = Object.values(a).find(
      (v): v is { id: string } => !!v && typeof v === "object" && "id" in v,
    ),
    id = typeof a.id === "string" ? a.id : (a.newId as string | undefined) ?? nested?.id;
  return i.level === "error" || (!!id && !!i.entityIds?.includes(id));
}
