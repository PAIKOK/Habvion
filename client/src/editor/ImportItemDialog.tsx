import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../state/authStore";
import { Link } from "react-router-dom";
import type { FurnitureCategory, FurnitureItem, FurnitureShape, HomeDesign } from "@shared/types/home";
import { findFurnitureSpot } from "@shared/design/furniture";
import { newId } from "@shared/design/createDesign";
import { api } from "../api/client";
import { useDesignStore } from "../state/designStore";
import { useEditorStore } from "../state/editorStore";

type Draft = { name: string | null; imageUrl: string | null; price: number | null; currency: string | null; sourceUrl: string };
type Preview = { status: "ok"; draft: Draft } | { status: "blocked" | "no-data"; reason: string };
type Unit = "cm" | "in" | "ft";

/** What it is decides how it is drawn and checked; the size always comes from the person. */
const KINDS: { label: string; category: FurnitureCategory; shape: FurnitureShape; mount?: FurnitureItem["mount"]; color: string }[] = [
  { label: "Sofa", category: "seating", shape: "sofa", color: "#8c8f86" },
  { label: "Armchair", category: "seating", shape: "armchair", color: "#9a7b5f" },
  { label: "Chair", category: "seating", shape: "chair", color: "#7d6a55" },
  { label: "Table", category: "tables", shape: "table", color: "#8a6240" },
  { label: "Desk", category: "tables", shape: "desk", color: "#8a6240" },
  { label: "Bed", category: "beds", shape: "bed", color: "#b9a68e" },
  { label: "Wardrobe", category: "storage", shape: "wardrobe", color: "#7a5c40" },
  { label: "Cabinet or sideboard", category: "storage", shape: "cabinet", color: "#8a6240" },
  { label: "Shelf or bookcase", category: "storage", shape: "shelf", color: "#8a6240" },
  { label: "Floor lamp", category: "lighting", shape: "lamp", color: "#d8c9a8" },
  { label: "Rug", category: "decor", shape: "rug", mount: "floor", color: "#b48a6a" },
  { label: "Plant", category: "decor", shape: "plant", color: "#5f8a52" },
  { label: "Appliance", category: "appliances", shape: "appliance", color: "#d9d9d6" },
  { label: "Something else", category: "decor", shape: "box", color: "#a39a8c" },
];
const TO_FT: Record<Unit, number> = { cm: 1 / 30.48, in: 1 / 12, ft: 1 };
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "item";

/** Paste a product link, confirm its real size, and it becomes something this design can place. */
export function ImportItemDialog({ design, onClose }: { design: HomeDesign; onClose: () => void }) {
  const dispatch = useDesignStore((s) => s.dispatch),
    provider = useAuthStore((s) => s.meshProvider),
    modelAvailable = provider !== "disabled-vercel",
    dialog = useRef<HTMLDivElement>(null),
    close = useRef(onClose),
    ui = useEditorStore(),
    room = design.rooms.find((r) => r.id === ui.selected);
  const [url, setUrl] = useState(""),
    [step, setStep] = useState<"link" | "form">("link"),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState(""),
    [error, setError] = useState(""),
    [name, setName] = useState(""),
    [price, setPrice] = useState(""),
    [imageUrl, setImageUrl] = useState<string | null>(null),
    [kind, setKind] = useState(0),
    [unit, setUnit] = useState<Unit>("cm"),
    [size, setSize] = useState({ w: "", d: "", h: "" }),
    [makeModel, setMakeModel] = useState(false),
    [rights, setRights] = useState(false),
    [externalConsent, setExternalConsent] = useState(false);
  close.current = onClose;
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const all = () => [...(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]') ?? [])].filter((e) => e.getClientRects().length);
    all()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close.current(); return; }
      if (e.key !== "Tab") return;
      const list=all(), first=list[0], last=list.at(-1);
      if (!first || !last) { e.preventDefault(); dialog.current?.focus(); }
      else if (e.shiftKey && (document.activeElement===first || !dialog.current?.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement===last || !dialog.current?.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown",key,true);
    return () => { document.removeEventListener("keydown",key,true); if (before?.isConnected) before.focus(); };
  }, []);

  async function read() {
    setError("");
    setBusy(true);
    try {
      const p = await api<Preview>("/imports/preview", { body: { url: url.trim() } });
      if (p.status === "ok") {
        setName(p.draft.name ?? "");
        setPrice(p.draft.price && (!p.draft.currency || p.draft.currency === "INR") ? String(Math.round(p.draft.price)) : "");
        setImageUrl(p.draft.imageUrl);
        setNote("Check the details, and type the size from the product page — we never guess it.");
      } else setNote(`${p.reason} Type the details in yourself.`);
      setStep("form");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that link.");
    } finally {
      setBusy(false);
    }
  }
  const feet = (v: string) => Math.round(Number(v) * TO_FT[unit] * 100) / 100;
  const dims = { width: feet(size.w), depth: feet(size.d), height: feet(size.h) };
  const sizeOk = Object.values(dims).every((v) => Number.isFinite(v) && v >= 0.1 && v <= 20);

  async function confirm(place: "auto" | "click" | "none") {
    if (makeModel && !modelAvailable) return setError("Photo-to-3D generation is unavailable on this deployment. Turn it off to save this item.");
    if (makeModel && (!rights || (provider !== "mock" && !externalConsent))) return setError("Confirm that you may process the photo and, for an external provider, consent to sending it.");
    const k = KINDS[kind]!,
      item: FurnitureItem = {
        id: `custom-${slug(name)}-${Math.random().toString(36).slice(2, 7)}`,
        name: name.trim(),
        category: k.category,
        ...dims,
        price: Math.max(0, Math.round(Number(price) || 0)),
        suitableFor: [],
        colorHex: k.color,
        shape: k.shape,
        mount: k.mount ?? "floor",
        ...(url.trim() ? { sourceUrl: url.trim() } : {}),
        ...(imageUrl ? { imageUrl } : {}),
      };
    const added = dispatch({ type: "custom-item/add", item });
    if (!added?.applied) return setError(useDesignStore.getState().issues[0]?.message ?? "That item could not be added.");
    if (makeModel && imageUrl) void startModel(item.id, imageUrl);
    if (place === "auto" && room) {
      const now = useDesignStore.getState().design!,
        spot = findFurnitureSpot(now, room.id, item.id);
      if (spot) dispatch({ type: "furniture/add", piece: { id: newId("piece"), catalogId: item.id, roomId: room.id, floor: room.floor, ...spot } });
      else useDesignStore.setState({ issues: [{ level: "error", code: "furniture/no-space", message: `${item.name} is in Your items, but there is no clear spot for it in ${room.name}.` }] });
    } else if (place === "click") ui.set({ paletteId: item.id, tool: "furniture" });
    onClose();
  }
  async function startModel(id: string, image: string) {
    try {
      const { job } = await api<{ job: NonNullable<FurnitureItem["meshJob"]> }>("/imports/mesh", { body: { imageUrl: image, rightsConfirmed: rights, ...(externalConsent ? { externalConsent: true } : {}) } });
      dispatch({ type: "custom-item/set-model", id, patch: { meshJob: job } });
    } catch (e) {
      dispatch({ type: "custom-item/set-model", id, patch: { meshJob: { id: "none", status: "failed", error: e instanceof Error ? e.message : "The 3D model could not be started." } } });
    }
  }

  return (
    <div className="import-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialog} tabIndex={-1} className="import-dialog" role="dialog" aria-modal="true" aria-label="Import from a link">
        <div className="import-head">
          <h2>Import from a link</h2>
          <button type="button" className="small-button" aria-label="Close import dialog" onClick={onClose}>
            ✕
          </button>
        </div>
        {step === "link" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (url.trim()) void read();
            }}
          >
            <p className="small-note">Our server visits the public product page you request to read its name, photo address and price. You confirm the size. Only process material you are authorised to use; public availability is not a copyright licence. Do not paste private or tokenised links.</p>
            <label className="field">
              <span>Product link</span>
              <input autoFocus aria-label="Product link" placeholder="https://www.ikea.com/in/en/p/…" value={url} onChange={(e) => setUrl(e.target.value)} />
            </label>
            {error && <p className="error-text" role="alert">{error}</p>}
            <div className="import-actions">
              <button type="button" className="small-button" onClick={() => setStep("form")}>
                Type it in instead
              </button>
              <button className="button button-accent" disabled={busy || !url.trim()}>
                {busy ? "Reading…" : "Read the page"}
              </button>
            </div>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void confirm(room ? "auto" : "click");
            }}
          >
            {note && <p className="import-note" data-testid="import-note">{note}</p>}
            <div className="import-body">
              {imageUrl && <p className="small-note">A photo address was found. It is not embedded here, so your browser does not automatically contact its host. <Link to="/privacy">Privacy details</Link>.</p>}
              <div>
                <label className="field">
                  <span>Name</span>
                  <input aria-label="Item name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
                </label>
                <div className="fields-row">
                  <label className="field">
                    <span>What is it?</span>
                    <select aria-label="Kind of item" value={kind} onChange={(e) => setKind(Number(e.target.value))}>
                      {KINDS.map((k, i) => (
                        <option key={k.label} value={i}>
                          {k.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Price (₹)</span>
                    <input aria-label="Price" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))} />
                  </label>
                </div>
              </div>
            </div>
            <fieldset className="import-size">
              <legend>
                Size <small>from the product page</small>
              </legend>
              <div className="tool-group" role="group" aria-label="Units">
                {(["cm", "in", "ft"] as const).map((u) => (
                  <button type="button" key={u} className={unit === u ? "active" : ""} onClick={() => setUnit(u)}>
                    {u}
                  </button>
                ))}
              </div>
              {(["w", "d", "h"] as const).map((k) => (
                <label className="field" key={k}>
                  <span>{{ w: "Width", d: "Depth", h: "Height" }[k]}</span>
                  <input aria-label={{ w: "Width", d: "Depth", h: "Height" }[k]} inputMode="decimal" value={size[k]} onChange={(e) => setSize({ ...size, [k]: e.target.value.replace(/[^\d.]/g, "") })} />
                </label>
              ))}
            </fieldset>
            <p className="small-note">{sizeOk ? `${dims.width} × ${dims.depth} × ${dims.height} ft` : "Each side must be between 3 cm and 6 m."}</p>
            {imageUrl && !modelAvailable && <p className="small-note">Photo-to-3D generation is unavailable on this deployment. You can still add this item using its dimensions; built-in furniture and 3D previews remain available.</p>}
            {imageUrl && modelAvailable && (
              <label className="check-field">
                <input type="checkbox" checked={makeModel} onChange={(e) => setMakeModel(e.target.checked)} /> Make a 3D model from the photo <small>({provider === "mock" ? "local demo model; no external photo processing" : "optional external processing"})</small>
              </label>
            )}
            {makeModel && <div className="import-permissions"><label className="check-field"><input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} data-testid="image-rights" /> I own, have a licence for, or am otherwise authorised to process this photo and create a model from it.</label>{provider !== "mock" && <label className="check-field"><input type="checkbox" checked={externalConsent} onChange={(e) => setExternalConsent(e.target.checked)} data-testid="mesh-consent" /> Allow the photo address to be sent to {provider === "tripo" ? "Tripo" : "the configured external 3D provider"}. Do not use identifying or sensitive photos.</label>}</div>}
            {error && <p className="error-text" role="alert">{error}</p>}
            <div className="import-actions">
              <button type="button" className="small-button" disabled={!sizeOk || !name.trim()} onClick={() => void confirm("none")}>
                Just save it
              </button>
              <button className="button button-accent" disabled={!sizeOk || !name.trim()}>
                {room ? `Add to ${room.name}` : "Add, then click a room"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
