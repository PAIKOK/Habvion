import { useEffect, useState } from "react";
import { PageSkeleton } from "../ui/Skeleton";
import { Link, Navigate, useParams } from "react-router-dom";
import type { HomeDesign } from "@shared/types/home";
import { api, ApiError } from "../api/client";
import { useDesignStore } from "../state/designStore";
import { startAutosave } from "../state/autosave";
import { Header } from "../ui/Header";
import { EditorPage } from "./EditorPage";

/** `/editor/:id`: load the saved design (unless it is already open), then autosave it. */
export function EditorRoute() {
  const { id } = useParams(),
    open = useDesignStore((s) => s.design),
    dispatch = useDesignStore((s) => s.dispatch),
    [state, setState] = useState<"loading" | "ready" | "missing" | "error">(open && open.id === id ? "ready" : "loading"),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (!id || useDesignStore.getState().design?.id === id) return void setState("ready");
    let live = true;
    setState("loading");
    api<{ design: HomeDesign }>(`/designs/${encodeURIComponent(id)}`).then(
      (r) => {
        if (!live) return;
        const loaded = dispatch({ type: "design/load", design: r.design });
        setState(loaded?.applied ? "ready" : "error");
        if (!loaded?.applied) setMessage("This saved design no longer passes the rules and cannot be opened.");
      },
      (e: unknown) => {
        if (!live) return;
        setState(e instanceof ApiError && e.status === 404 ? "missing" : "error");
        setMessage(e instanceof Error ? e.message : "Could not load the design.");
      },
    );
    return () => {
      live = false;
    };
  }, [id, dispatch]);
  useEffect(() => (id && state === "ready" ? startAutosave(id) : undefined), [id, state]);
  if (!id) return open ? <Navigate to={`/editor/${open.id}`} replace /> : <EditorPage />;
  if (state === "ready") return <EditorPage />;
  return (
    <>
      <Header />
      <main id="main" tabIndex={-1} className="section-shell placeholder-page" aria-busy={state === "loading"}>
        {state === "loading" ? (
          <PageSkeleton label="Opening your design" />
        ) : (
          <>
            <h1>{state === "missing" ? "Design not found." : "Could not open this design."}</h1>
            <p>{message}</p>
            <Link className="button button-accent" to="/designs">
              My designs
            </Link>
          </>
        )}
      </main>
    </>
  );
}
