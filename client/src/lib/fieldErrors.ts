import type { z } from "zod";

/** The first message for each field, keyed by field name, from a failed zod parse. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

/** Move focus to the first field with an error, in page order, so keyboard and screen-reader users land on it. */
export function focusFirstError(form: HTMLFormElement | null) {
  // After React has rendered the error states. A timer, not requestAnimationFrame, which pauses in background tabs.
  setTimeout(() => form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);
}
