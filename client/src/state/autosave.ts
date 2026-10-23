import { create } from "zustand";
import { api } from "../api/client";
import { useDesignStore } from "./designStore";

export type SaveStatus = "saved" | "pending" | "saving" | "error";
export const useSaveStore = create<{ status: SaveStatus; message: string; savedAt: number | null }>(() => ({
  status: "saved",
  message: "",
  savedAt: null,
}));
const DEBOUNCE_MS = 1000,
  RETRY_MS = 5000;

/**
 * Save the open design whenever it changes: debounced, one request at a time, last
 * write wins. Returns a stop function that makes a final best-effort save.
 */
export function startAutosave(designId: string) {
  let last = useDesignStore.getState().design,
    dirty = false,
    inFlight = false,
    timer: ReturnType<typeof setTimeout> | undefined;
  const set = useSaveStore.setState;
  set({ status: "saved", message: "", savedAt: Date.now() });
  const schedule = (ms: number) => {
    clearTimeout(timer);
    timer = setTimeout(() => void flush(), ms);
  };
  async function flush() {
    const design = useDesignStore.getState().design;
    if (inFlight || !dirty || !design || design.id !== designId) return;
    dirty = false;
    inFlight = true;
    set({ status: "saving" });
    try {
      await api(`/designs/${encodeURIComponent(designId)}`, { method: "PUT", body: { design } });
      set({ status: dirty ? "pending" : "saved", message: "", savedAt: Date.now() });
    } catch (e) {
      dirty = true;
      set({ status: "error", message: e instanceof Error ? e.message : "Could not save." });
      schedule(RETRY_MS);
    } finally {
      inFlight = false;
      if (dirty && useSaveStore.getState().status !== "error") schedule(DEBOUNCE_MS);
    }
  }
  const unsubscribe = useDesignStore.subscribe((s) => {
    if (!s.design || s.design.id !== designId || s.design === last) return;
    last = s.design;
    dirty = true;
    if (!inFlight) set({ status: "pending" });
    schedule(DEBOUNCE_MS);
  });
  const warn = (e: BeforeUnloadEvent) => {
    if (dirty || inFlight) {
      e.preventDefault();
      e.returnValue = "";
    }
  };
  window.addEventListener("beforeunload", warn);
  return () => {
    unsubscribe();
    window.removeEventListener("beforeunload", warn);
    clearTimeout(timer);
    if (dirty) void flush();
  };
}
/** True while there are edits the server has not confirmed. */
export const hasUnsavedChanges = () => useSaveStore.getState().status !== "saved";
