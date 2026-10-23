import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icons";
async function copyText(text: string) {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* Try the local fallback; never report success without a successful copy. */ }
  const before = document.activeElement as HTMLElement | null, box = document.createElement("textarea");
  box.value = text; box.setAttribute("readonly", ""); box.style.cssText = "position:fixed;left:-10000px;top:0";
  document.body.appendChild(box); box.select();
  try { return document.execCommand("copy"); } catch { return false; }
  finally { box.remove(); before?.focus(); }
}
/** Writes only on a deliberate click, restores focus, and announces a real result. */
export function CopyButton({ text, label = "Copy", className = "small-button copy-button" }: { text: string; label?: string; className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle"), timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return <span className="copy-control"><button type="button" className={className} data-state={state} aria-label={label} onClick={async () => {
    setState((await copyText(text)) ? "copied" : "failed"); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setState("idle"), 4000);
  }}><Icon name={state === "copied" ? "check" : "copy"} size={15}/><span>{state === "copied" ? "Copied" : label}</span></button><span role="status" className={state === "failed" ? "copy-error" : "sr-only"}>{state === "copied" ? "Copied to clipboard." : state === "failed" ? "Could not copy. Select the text and copy it manually." : ""}</span></span>;
}
