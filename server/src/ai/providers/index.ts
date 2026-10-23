import type { Environment } from "../../config/envSchema.js";
import { GeminiProvider } from "./gemini.js";
import { MockProvider } from "./mock.js";
import type { AiProvider } from "./provider.js";

export { AiError, type AiProvider, type PlanRequest, type ChatTurn } from "./provider.js";

/** The only place a provider is chosen. The key comes from the parsed environment. */
export function createAiProvider(config: Environment): AiProvider {
  if (config.AI_PROVIDER === "gemini") return new GeminiProvider(config.GOOGLE_API_KEY!, config.GEMINI_MODEL);
  return new MockProvider();
}
