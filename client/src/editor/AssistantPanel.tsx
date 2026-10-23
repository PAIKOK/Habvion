import { useRef, useState } from "react";
import type { HomeDesign } from "@shared/types/home";
import { api } from "../api/client";
import { useDesignStore } from "../state/designStore";
import { useAuthStore } from "../state/authStore";
import { Link } from "react-router-dom";

type Outcome = { type: string; applied: boolean; message: string };
type Turn =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; outcomes?: Outcome[]; dropped?: number; error?: boolean };
type PlanResponse = { reply: string; outcomes: Outcome[]; design: HomeDesign | null; dropped: number; provider: string };
const EXAMPLES = ["Add a bathroom next to the master bedroom", "Furnish the living room", "Paint the kitchen sage", "Give it a gable roof"];

/**
 * Chat with the design assistant. The server plans, translates and validates the
 * changes with the shared rules; the result is re-validated here and committed as
 * one undo step.
 */
export function AssistantPanel({ design }: { design: HomeDesign }) {
  const dispatch = useDesignStore((s) => s.dispatch),
    provider = useAuthStore((s) => s.aiProvider),
    [externalConsent, setExternalConsent] = useState(false),
    [turns, setTurns] = useState<Turn[]>([]),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    end = useRef<HTMLDivElement>(null);
  async function send(message: string) {
    if (!message.trim() || busy || (provider !== "mock" && !externalConsent)) return;
    const history = turns.slice(-8).map((t) => ({ role: t.role, text: t.text }));
    setTurns((t) => [...t, { role: "user", text: message }]);
    setText("");
    setBusy(true);
    try {
      const plan = await api<PlanResponse>("/ai/plan", { body: { message, design, history, ...(externalConsent ? { externalConsent: true } : {}) } });
      let outcomes = plan.outcomes;
      if (plan.design && !dispatch({ type: "history/commit", design: plan.design })?.applied)
        outcomes = outcomes.map((o) => ({ ...o, applied: false, message: o.applied ? "Not applied: the result failed validation here." : o.message }));
      setTurns((t) => [...t, { role: "assistant", text: plan.reply, outcomes, dropped: plan.dropped }]);
    } catch (e) {
      setTurns((t) => [...t, { role: "assistant", text: e instanceof Error ? e.message : "Something went wrong.", error: true }]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => end.current?.scrollIntoView({ block: "end" }));
    }
  }
  return (
    <div className="assistant" data-testid="assistant">
      <div className="assistant-privacy"><p>{provider === "mock" ? "Demo assistant: rule-based responses; no external AI request." : "External AI is optional. Your request, relevant room-layout details and recent assistant messages are sent to the configured provider, not your password or account profile."} Results may be wrong and are not construction advice. Avoid personal or sensitive information. <Link to="/privacy">Privacy details</Link>.</p>
      {provider !== "mock" && <label className="check-field"><input type="checkbox" checked={externalConsent} onChange={(e) => setExternalConsent(e.target.checked)} data-testid="ai-consent" /><span>Allow these requests and relevant layout details to be sent to {provider === "gemini" ? "Google Gemini" : "the external AI provider"}. Untick to stop future requests; already-sent data cannot be recalled here.</span></label>}</div>
      <div className="assistant-log" aria-live="polite">
        {!turns.length && (
          <div className="assistant-empty">
            <p>Describe a change and I will make it. Every change is checked like a manual edit and can be undone in one step.</p>
            {EXAMPLES.map((e) => (
              <button key={e} className="chip" disabled={busy || (provider !== "mock" && !externalConsent)} onClick={() => send(e)}>
                {e}
              </button>
            ))}
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={`turn turn-${t.role}${t.role === "assistant" && t.error ? " turn-error" : ""}`}>
            <div className="turn-text">{t.text}</div>
            {t.role === "assistant" && !!t.outcomes?.length && (
              <ul className="outcomes">
                {t.outcomes.map((o, k) => (
                  <li key={k} className={o.applied ? "ok" : "refused"} data-applied={o.applied}>
                    <span aria-hidden>{o.applied ? "✓" : "✕"}</span> {o.message}
                  </li>
                ))}
              </ul>
            )}
            {t.role === "assistant" && !!t.dropped && <div className="muted small">{t.dropped} unusable instruction(s) were ignored.</div>}
          </div>
        ))}
        {busy && <div className="turn turn-assistant muted">Thinking…</div>}
        <div ref={end} />
      </div>
      <form
        className="assistant-input"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <textarea
          aria-label="Message the assistant"
          rows={2}
          value={text}
          maxLength={2000}
          placeholder="e.g. add a pooja room near the living room"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(text);
            }
          }}
        />
        <button type="submit" className="primary" disabled={busy || !text.trim() || (provider !== "mock" && !externalConsent)}>
          Send design request
        </button>
      </form>
    </div>
  );
}
