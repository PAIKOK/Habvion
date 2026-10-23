import { SYSTEM_PROMPT, describeDesign } from "@shared/ai/context";
import { AiError, type AiProvider, type PlanRequest } from "./provider.js";

const TIMEOUT_MS = 30_000;

/**
 * Google Gemini over plain fetch. The key arrives through the constructor from the
 * parsed environment; it is sent only as a request header and never logged or echoed.
 */
export class GeminiProvider implements AiProvider {
  readonly name = "gemini";
  readonly #apiKey: string;
  constructor(
    apiKey: string,
    private readonly model: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.#apiKey = apiKey;
  }
  async plan(req: PlanRequest, signal?: AbortSignal): Promise<unknown> {
    const abort = new AbortController(),
      timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
    signal?.addEventListener("abort", () => abort.abort(), { once: true });
    const contents = [
      ...req.history.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.text }] })),
      { role: "user", parts: [{ text: `Current design:\n${describeDesign(req.design)}\n\nRequest: ${req.message}` }] },
    ];
    let res: Response;
    try {
      res = await this.fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`,
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": this.#apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents,
            generationConfig: { responseMimeType: "application/json", temperature: 0.3 },
          }),
          signal: abort.signal,
        },
      );
    } catch {
      throw new AiError(504, abort.signal.aborted ? "The AI service took too long to answer." : "Could not reach the AI service.");
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      // Upstream bodies can quote the request; never pass them through.
      if (res.status === 400) throw new AiError(502, "The AI service rejected the request.");
      if (res.status === 401 || res.status === 403)
        throw new AiError(502, "The AI service refused this API key. Check that the key's Google project allows the Gemini API.");
      if (res.status === 429) throw new AiError(429, "The AI service is busy or over quota. Try again in a minute.");
      throw new AiError(502, `The AI service failed (${res.status}).`);
    }
    const body = (await res.json().catch(() => null)) as { candidates?: { content?: { parts?: { text?: string }[] } }[] } | null,
      text = body?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    try {
      return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    } catch {
      throw new AiError(502, "The AI service returned something that was not a plan.");
    }
  }
}
