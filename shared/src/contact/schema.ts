import { z } from "zod";
import { emailSchema } from "../auth/schemas";

export const CONTACT_TOPICS = [
  { value: "general", label: "A general question" },
  { value: "design-help", label: "Help with my design" },
  { value: "demo-homes", label: "About the demo homes" },
  { value: "costs", label: "Cost estimates" },
  { value: "account", label: "My account" },
  { value: "privacy", label: "Privacy or my data" },
  { value: "problem", label: "Something is not working" },
  { value: "other", label: "Something else" },
] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number]["value"];

/** Campaign tags a visitor arrived with (`?utm_source=…`), kept with the message so we know which link brought them. */
export const UTM_KEYS = ["source", "medium", "campaign", "term", "content"] as const;
export type Utm = Partial<Record<(typeof UTM_KEYS)[number], string>>;
const utmValue = z.string().trim().min(1).max(60).regex(/^[A-Za-z][A-Za-z0-9 _-]*$/).refine((v) => !/[a-f0-9]{20,}/i.test(v));
export const utmSchema = z.object(Object.fromEntries(UTM_KEYS.map((k) => [k, utmValue.optional()])) as Record<(typeof UTM_KEYS)[number], z.ZodOptional<typeof utmValue>>);

/** One rule set for the form and the server, so both refuse the same things with the same words. */
export const contactSchema = z.object({
  name: z.string().trim().max(80, "That name is too long.").optional().transform((v) => v || "Visitor"),
  email: z.string({ error: "Enter a valid email address." }).pipe(emailSchema),
  topic: z.enum(CONTACT_TOPICS.map((t) => t.value) as [ContactTopic, ...ContactTopic[]], { message: "Pick what your question is about." }),
  message: z.string({ error: "Write your message." }).trim().min(10, "Write at least a sentence (10 characters).").max(4000, "Keep it under 4,000 characters."),
  /** No longer asked: the age and terms agreement is taken at sign-up only. Accepted and ignored for older pages. */
  consent: z.boolean().optional(),
  /** No longer asked: every enquiry is forwarded to the team when forwarding is configured. Accepted and ignored for older pages. */
  forwardingConsent: z.boolean().optional(),
  utm: utmSchema.optional().catch(undefined),
  /** No longer asked: campaign tags travel with the message automatically. Accepted and ignored for older pages. */
  attributionConsent: z.boolean().optional(),
  /** A field people never see. Bots fill every field; a filled one is quietly dropped. */
  website: z.string().max(200).optional(),
});
export type ContactInput = z.input<typeof contactSchema>;
