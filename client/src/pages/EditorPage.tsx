import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Header } from "../ui/Header";
import { PlanCanvas } from "../editor/PlanCanvas";
import { FurniturePalette } from "../editor/FurniturePalette";
const Scene3D = lazy(() => import("../three/Scene3D").then((m) => ({ default: m.Scene3D })));
import { SidePanel } from "../editor/SidePanel";
import { useMeshJobs } from "../editor/useMeshJobs";
import { AssistantPanel } from "../editor/AssistantPanel";
import { SaveIndicator } from "../editor/SaveIndicator";
import { ShareButton } from "../editor/ShareButton";
import { useSaveStore } from "../state/autosave";
import { useParams } from "react-router-dom";
import { useDesignStore } from "../state/designStore";
import { useEditorStore } from "../state/editorStore";
import { ROOM_INFO, roomName } from "@shared/design/roomTypes";
import { ROOM_TYPES, type HomeDesign, type RoomType } from "@shared/types/home";
import { newId } from "@shared/design/createDesign";
import { freeRoomSpot } from "@shared/design/placement";
import { floorLabel, plural } from "@shared/lib/units";
import type { StoreAction } from "../state/designStore";
export function EditorPage() {
  const params = useParams(),
    state = useDesignStore(),
    ui = useEditorStore(),
    design = state.design,
    navigate = useNavigate(),
    [leaving, setLeaving] = useState(false);
  useMeshJobs(design);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      // Keys typed into a field or an open dialog are not editor shortcuts.
      if ((e.target as HTMLElement).closest("input,select,textarea,dialog")) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        state.dispatch({ type: e.shiftKey ? "history/redo" : "history/undo" });
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") ui.set({ tool: "select", selected: null, paletteId: null });
      if (e.key === "r" && ui.selected) {
        const piece = state.design?.furniture.find((f) => f.id === ui.selected);
        if (piece) {
          state.dispatch({
            type: "furniture/update",
            id: piece.id,
            patch: { rotation: (piece.rotation + 90) % 360 },
          });
          return;
        }
      }
      if (e.key === "r") ui.set({ tool: "room" });
      if (e.key === "v") ui.set({ tool: "select" });
      if ((e.key === "Delete" || e.key === "Backspace") && ui.selected) {
        const action = deleteActionFor(state.design, ui.selected);
        if (action && state.dispatch(action)?.applied) ui.set({ selected: null });
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [state.dispatch, state.design, ui.selected]);
  if (!design)
    return (
      <>
        <Header />
        <main id="main" tabIndex={-1} className="section-shell placeholder-page">
          <h1>Your plot is waiting.</h1>
          <p>Create a plot before opening the editor.</p>
          <Link className="button button-accent" to="/start">
            Set up a plot
          </Link>
        </main>
      </>
    );
  return (
    <div className="editor-page">
      <Header>
        <span className="editor-design-name">{design.name}</span>
        {params.id && <SaveIndicator />}
        {params.id && <ShareButton designId={params.id} />}
        <Link
          className="text-link"
          to="/designs"
          onClick={(e) => {
            if (useSaveStore.getState().status !== "saved") {
              e.preventDefault();
              setLeaving(true);
            }
          }}
        >
          My designs
        </Link>
      </Header>
      <main id="main" tabIndex={-1} className="editor-main">
      <h1 className="sr-only">Design editor: {design.name}</h1>
      <div className="editor-toolbar">
        <div className="tool-group view-toggle" role="group" aria-label="View">
          {(["2d", "3d"] as const).map((v) => (
            <button key={v} aria-pressed={ui.view === v} className={ui.view === v ? "active" : ""} onClick={() => ui.set({ view: v })}>
              {v.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="tool-group">
          {(["select", "room", "door", "window", "stair", "furniture", "pan", "measure"] as const).map((tool) => (
            <button
              key={tool}
              aria-pressed={ui.tool === tool}
              className={ui.tool === tool ? "active" : ""}
              onClick={() => ui.set({ tool })}
            >
              {tool === "room" ? "Draw room" : tool[0]!.toUpperCase() + tool.slice(1)}
            </button>
          ))}
        </div>
        <select
          aria-label="Room to draw"
          value={ui.roomType}
          onChange={(e) => ui.set({ roomType: e.target.value as RoomType })}
        >
          {ROOM_TYPES.map((t) => (
            <option key={t} value={t}>
              {ROOM_INFO[t].label}
            </option>
          ))}
        </select>
        <button
          className="small-button"
          onClick={() => {
            const p = freeRoomSpot(design, ui.roomType, ui.floor);
            if (p) {
              const info = ROOM_INFO[ui.roomType],
                id = newId("room");
              const r = state.dispatch({
                type: "room/add",
                room: {
                  id,
                  name: roomName(
                    ui.roomType,
                    design.rooms.map((r) => r.name),
                  ),
                  type: ui.roomType,
                  ...p,
                  width: info.width,
                  length: info.length,
                  floor: ui.floor,
                },
              });
              if (r?.applied) ui.set({ selected: id, tool: "select" });
            } else alert("No room of this size fits on this floor.");
          }}
        >
          Add room
        </button>
        <div className="floor-tabs" role="tablist" aria-label="Floors">
          {design.floors.map((f) => (
            <button
              key={f.level}
              role="tab"
              aria-selected={ui.floor === f.level}
              className={ui.floor === f.level ? "active" : ""}
              onClick={() => ui.set({ floor: f.level, selected: null })}
            >
              {f.level === 0 ? "Ground" : floorLabel(f.level).replace(" floor", "")}
            </button>
          ))}
          <button
            aria-label="Add a floor"
            title="Add a floor"
            onClick={() => {
              const r = state.dispatch({ type: "floors/count", count: design.floors.length + 1 });
              if (r?.applied) ui.set({ floor: design.floors.length, selected: null });
            }}
          >
            +
          </button>
        </div>
        <label className="snap-toggle">
          <input
            type="checkbox"
            checked={ui.snap}
            onChange={(e) => ui.set({ snap: e.target.checked })}
          />{" "}
          Snap
        </label>
        <div className="toolbar-spacer" />
        <button
          className="small-button"
          disabled={!state.past.length}
          onClick={() => state.dispatch({ type: "history/undo" })}
        >
          Undo
        </button>
        <button
          className="small-button"
          disabled={!state.future.length}
          onClick={() => state.dispatch({ type: "history/redo" })}
        >
          Redo
        </button>
      </div>
      <div className="editor-workspace">
        {ui.tool === "furniture" && <FurniturePalette design={design} />}
        <div className="editor-viewport">
          {ui.view === "3d" ? (
            <Suspense fallback={<div className="scene-loading">Building the 3D model…</div>}>
              <Scene3D design={design} />
            </Suspense>
          ) : (
            <PlanCanvas design={design} />
          )}
          <div className="editor-status">
            <span>
              {floorLabel(ui.floor)} · {plural(design.rooms.filter((r) => r.floor === ui.floor).length, "room")}
            </span>
            <span>0.5 ft snap · scroll to zoom · Alt for free placement</span>
          </div>
          {state.issues.length > 0 && (
            <div className="action-issues" role="alert">
              <button
                className="action-issues-close"
                aria-label="Dismiss"
                onClick={() => useDesignStore.setState({ issues: [] })}
              >
                ×
              </button>
              {state.issues.slice(0, 4).map((i, n) => (
                <p key={n} className={i.level === "error" ? "error-text" : ""}>
                  {i.message}
                </p>
              ))}
            </div>
          )}
        </div>
        <SidePanel design={design} extra={[{ id: "assistant", label: "Assistant", render: () => <AssistantPanel design={design} /> }]} />
      </div>
      </main>
      <ConfirmDialog
        open={leaving}
        title="Leave with unsaved changes?"
        confirmLabel="Leave anyway"
        cancelLabel="Stay and keep editing"
        danger
        onConfirm={() => {
          setLeaving(false);
          navigate("/designs");
        }}
        onCancel={() => setLeaving(false)}
      >
        <p>Your latest changes have not reached the server yet. If you leave now, they may be lost.</p>
      </ConfirmDialog>
    </div>
  );
}

/** The delete action for whatever entity is selected, whatever its kind. */
export function deleteActionFor(design: HomeDesign | null, id: string): StoreAction | null {
  if (!design) return null;
  if (design.rooms.some((r) => r.id === id)) return { type: "room/delete", id };
  if (design.doors.some((o) => o.id === id)) return { type: "door/delete", id };
  if (design.windows.some((o) => o.id === id)) return { type: "window/delete", id };
  if (design.stairs.some((o) => o.id === id)) return { type: "stair/delete", id };
  if (design.furniture.some((o) => o.id === id)) return { type: "furniture/delete", id };
  return null;
}
