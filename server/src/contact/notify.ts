import { CONTACT_TOPICS } from "@shared/contact/schema";
import type { Environment } from "../config/envSchema.js";
import type { StoredMessage } from "../repositories/messages.js";

/** Passes a saved enquiry on somewhere people will see it. Throws a readable error on failure. */
export type ContactNotifier = (message: StoredMessage) => Promise<void>;

export class NotifyError extends Error {}

/**
 * Post each enquiry to a Google Apps Script web app, which appends it to a sheet and
 * emails it. The shared secret travels in the body (Apps Script cannot read headers),
 * is held only in this closure, and never appears in an error or a log line.
 */
export function createContactNotifier(config: Pick<Environment, "CONTACT_WEBHOOK_URL" | "CONTACT_WEBHOOK_SECRET"> & Partial<Pick<Environment, "CONTACT_FORWARDING_ENABLED">>, fetchImpl: typeof fetch = fetch): ContactNotifier | undefined {
  const url = config.CONTACT_WEBHOOK_URL,
    secret = config.CONTACT_WEBHOOK_SECRET;
  if (!config.CONTACT_FORWARDING_ENABLED || !url || !secret) return undefined;
  return async (m) => {
    let res: Response;
    try {
      res = await fetchImpl(url, {
        method: "POST",
        // text/plain keeps Apps Script from rejecting the request; the body is still JSON.
        headers: { "content-type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          secret,
          reference: m.id,
          receivedAt: m.createdAt,
          name: m.name,
          email: m.email,
          phone: "", // Kept blank for compatibility with older sheets; no new phone data is collected.
          topic: m.topic,
          topicLabel: CONTACT_TOPICS.find((t) => t.value === m.topic)?.label ?? m.topic,
          message: m.message,
          signedIn: !!m.userId,
        }),
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
      });
    } catch (e) {
      throw new NotifyError((e as Error).name === "TimeoutError" ? "Google did not answer within 15 seconds." : "Google could not be reached.");
    }
    const text = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403)
      throw new NotifyError(
        `Google refused access (${res.status}): the web app needs a signed-in Google user. Set the deployment's 'Who has access' to 'Anyone'. Work or school accounts often cannot offer 'Anyone' — deploy from a personal Gmail account instead.`,
      );
    if (!res.ok) throw new NotifyError(`Google answered ${res.status}. Check the web app URL is the latest deployment.`);
    let reply: { ok?: boolean; error?: string } | null = null;
    try {
      reply = JSON.parse(text);
    } catch {
      throw new NotifyError("Google answered with a web page instead of the script's reply. In the deployment, set 'Who has access' to 'Anyone'.");
    }
    if (!reply?.ok)
      throw new NotifyError(
        reply?.error === "unauthorised"
          ? "The script refused the secret. Make WEBHOOK_SECRET in the script's properties match CONTACT_WEBHOOK_SECRET."
          : "The Google workflow reported a failure. Check its private execution logs; enquiry content is not logged here.",
      );
  };
}
