import type { HomeDesign } from "@shared/types/home";

export type ChatTurn = { role: "user" | "assistant"; text: string };
export type PlanRequest = { message: string; design: HomeDesign; history: ChatTurn[] };

/** A model that turns a request into raw plan JSON. The caller validates everything. */
export interface AiProvider {
  readonly name: string;
  plan(req: PlanRequest, signal?: AbortSignal): Promise<unknown>;
}

/** An error whose message is safe to show the user: no keys, no upstream bodies. */
export class AiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
