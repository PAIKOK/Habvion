import { Router } from "express";
import { contactSchema } from "@shared/contact/schema";
import { newReference, type MessageRepository } from "../repositories/messages.js";
import { currentUser } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import type { ContactNotifier } from "../contact/notify.js";
import { POLICY_VERSION } from "@shared/legal/business";
import { MESSAGE_RETENTION_DAYS } from "../contact/retention.js";

/**
 * Public: anyone with a question can write in, signed in or not. Messages are stored
 * privately with the rest of the data first, then passed to the notifier (Google Sheets
 * and email) in the background, so a slow or broken notifier never loses a message.
 * No message content is logged.
 */
export function contactRouter(messages: MessageRepository, notify?: ContactNotifier) {
  const router = Router();
  router.post("/", rateLimit(5, "You have sent several messages in a row. Wait a minute and try again."), async (req, res) => {
    const p = contactSchema.safeParse(req.body);
    if (!p.success) return void res.status(400).json({ error: p.error.issues[0]?.message ?? "Check the form and try again." });
    // No tick boxes on this form: the Privacy Policy, linked beside the button, explains how a message is used.
    const { website, consent: _consent, forwardingConsent: _forwarding, attributionConsent: _attribution, utm, ...fields } = p.data;
    const campaign = utm && Object.values(utm).some(Boolean) ? Object.fromEntries(Object.entries(utm).filter(([, v]) => v)) : undefined;
    // The hidden field was filled, so this is a bot. Answer like a success and keep nothing.
    if (website) return void res.status(201).json({ reference: newReference() });
    const user = currentUser(res),
      saved = await messages.create({ ...fields, ...(campaign ? { utm: campaign } : {}), ...(user ? { userId: user.id } : {}),
        // The policy version in force when the message was sent.
        policyVersion: POLICY_VERSION, purpose: "enquiry-response",
        externalDeliveryPermitted: !!notify,
        expiresAt: new Date(Date.now() + MESSAGE_RETENTION_DAYS * 86_400_000).toISOString(),
      });
    console.log(`Contact message ${saved.id} received (${saved.topic}).`);
    res.status(201).json({ reference: saved.id });
    // Every enquiry goes to the team's sheet and inbox when forwarding is configured; the Privacy Policy says so.
    if (notify)
      notify(saved).then(
        () => console.log(`Contact message ${saved.id} sent to Google Sheets and email.`),
        (e: Error) => console.error(`Contact message ${saved.id} is saved, but was not sent to Google Sheets: ${e.message}`),
      );
  });
  return router;
}
