import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { FAQ } from "../content/faq";
import { useAuthStore } from "../state/authStore";
import { Icon } from "./Icons";

type Entry = { kind: string; title: string; text: string; to: string; words?: string };

/** Everything a visitor can reach, written the way people ask for it. */
const PAGES: Entry[] = [
  { kind: "Page", title: "Home", text: "Design it. See it. Make it yours.", to: "/", words: "start landing" },
  { kind: "Section", title: "How it works", text: "Draw rooms, see them in 3D, get an estimate.", to: "/#how-it-works", words: "features 3d walkthrough estimate rupees" },
  { kind: "Section", title: "Demo homes", text: "Ready-made homes you can open and customise.", to: "/#demo-homes", words: "examples inspiration villa bungalow bhk" },
  { kind: "Section", title: "Frequently asked questions", text: "Costs, estimates, sharing and your data.", to: "/#faq", words: "faq help questions" },
  { kind: "Page", title: "Start a new design", text: "Set up your plot and start drawing.", to: "/start", words: "new plot create design build" },
  { kind: "Page", title: "My designs", text: "Every home you have saved.", to: "/designs", words: "saved projects" },
  { kind: "Page", title: "Contact us", text: "Ask a question and get a reference number.", to: "/contact", words: "support help email enquiry message" },
  { kind: "Page", title: "Your account and data", text: "Download your data or delete your account.", to: "/account", words: "profile export delete privacy" },
  { kind: "Page", title: "Log in", text: "Pick up where you left off.", to: "/login", words: "sign in" },
  { kind: "Page", title: "Create an account", text: "Save your designs to an account.", to: "/signup", words: "sign up register" },
  { kind: "Policy", title: "Privacy Policy", text: "What we collect, why, and your rights.", to: "/privacy", words: "data dpdp personal information" },
  { kind: "Policy", title: "Terms of Service", text: "The rules for using the site.", to: "/terms", words: "terms conditions legal" },
  { kind: "Policy", title: "Cookie Policy", text: "The one cookie we use, and Google Sign-In.", to: "/cookies", words: "cookies consent" },
  { kind: "Policy", title: "Refund Policy", text: "Current payment status, building estimates and refund enquiries.", to: "/refunds", words: "refund payment price fees" },
  { kind: "Policy", title: "Credits", text: "Who made the 3D models and their licences.", to: "/credits", words: "licence attribution models" },
];

function score(e: Entry, terms: string[]) {
  const title = e.title.toLowerCase(),
    rest = `${e.text} ${e.words ?? ""} ${e.kind}`.toLowerCase();
  let total = 0;
  for (const t of terms) {
    if (title.startsWith(t)) total += 6;
    else if (title.includes(t)) total += 4;
    else if (rest.includes(t)) total += 1;
    else return 0; // every word must match somewhere
  }
  return total;
}

/** Search across pages, policy pages, FAQ answers and demo homes. Opens with the header button, Ctrl/⌘ K or "/". */
export function SiteSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null),
    input = useRef<HTMLInputElement>(null),
    nav = useNavigate(),
    signedIn = useAuthStore((s) => !!s.user),
    [query, setQuery] = useState(""),
    [active, setActive] = useState(0),
    [demos, setDemos] = useState<Entry[]>([]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      input.current?.focus();
    } else if (!open && d.open) {
      d.close();
      // Cleared on close, so the box is already empty when it next opens.
      setQuery("");
      setActive(0);
    }
  }, [open]);

  // Demo homes come from the server; fetch them the first time search opens.
  useEffect(() => {
    if (!open || demos.length) return;
    api<{ demos: { id: string; title: string; tagline: string }[] }>("/demos").then(
      (r) => setDemos(r.demos.map((d) => ({ kind: "Demo home", title: d.title, text: d.tagline, to: `/demos/${d.id}` }))),
      () => {},
    );
  }, [open, demos.length]);

  const all = useMemo(
    () => [
      ...PAGES.filter((p) => (signedIn ? !["/login", "/signup"].includes(p.to) : true)),
      ...demos,
      ...FAQ.map((f) => ({ kind: "Question", title: f.q, text: f.a, to: `/#faq-${f.id}` })),
    ],
    [demos, signedIn],
  );
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const results = terms.length
    ? all
        .map((e) => ({ e, s: score(e, terms) }))
        .filter((r) => r.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 8)
        .map((r) => r.e)
    : all.filter((e) => ["/#how-it-works", "/#demo-homes", "/contact", "/#faq", "/start"].includes(e.to));

  function go(e: Entry | undefined) {
    if (!e) return;
    onClose();
    nav(e.to);
    // Same-page anchors: react-router does not scroll to a hash by itself.
    const hash = e.to.split("#")[1];
    if (hash) setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }

  return (
    <dialog
      ref={ref}
      className="search-dialog"
      aria-label="Search the site"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="search-box">
        <div className="search-field">
          <Icon name="search" size={18} />
          <input
            ref={input}
            type="search"
            maxLength={100}
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="search-results"
            aria-activedescendant={results[active] ? `search-option-${active}` : undefined}
            aria-autocomplete="list"
            aria-label="Search pages, demo homes and questions"
            placeholder="Search pages, demo homes, questions…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === "Escape") {
                // In a search box the browser would only clear the text; close instead.
                e.preventDefault();
                onClose();
              } else if (e.key === "Enter") {
                e.preventDefault();
                go(results[active]);
              }
            }}
          />
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close search">
            <Icon name="close" size={18} />
          </button>
        </div>
        {!terms.length && <p className="search-hint">Suggestions</p>}
        <ul id="search-results" role="listbox" aria-label="Results" className="search-results">
          {results.map((r, i) => (
            <li
              key={r.kind + r.to + r.title}
              id={`search-option-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? "active" : ""}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(r)}
            >
              <span className="search-kind">{r.kind}</span>
              <strong>{r.title}</strong>
              <span className="search-text">{r.text}</span>
            </li>
          ))}
        </ul>
        {terms.length > 0 && !results.length && (
          <p className="search-empty" role="status">
            Nothing matches “{query}”. Try another word, or <button type="button" className="link-button" onClick={() => go({ kind: "", title: "", text: "", to: "/contact" })}>ask us</button>.
          </p>
        )}
        <p className="search-keys" aria-hidden="true">
          <kbd>↑</kbd> <kbd>↓</kbd> to move · <kbd>Enter</kbd> to open · <kbd>Esc</kbd> to close
        </p>
      </div>
    </dialog>
  );
}
