import { z } from "zod";

const schema = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    CORS_ORIGIN: z
      .string()
      .default("http://localhost:5173")
      .refine(
        (value) =>
          value.split(",").every((origin) => {
            try {
              const u = new URL(origin.trim());
              return ["http:", "https:"].includes(u.protocol) && u.origin === origin.trim();
            } catch {
              return false;
            }
          }),
        "Expected a comma-separated list of http(s) origins",
      ),
    AI_PROVIDER: z.enum(["gemini", "mock"]).default("gemini"),
    GOOGLE_API_KEY: z.string().min(1).optional(),
    GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash"),
    SESSION_SECRET: z
      .string()
      .min(32, "Must be at least 32 characters; generate with openssl rand -base64 48"),
    AUTH_COOKIE_NAME: z
      .string()
      .regex(/^[A-Za-z0-9_-]+$/)
      .default("hb_session"),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    MONGODB_URI: z.string().min(1).optional(),
    USERS_FILE: z.string().min(1).default("./data/users.json"),
    DESIGNS_FILE: z.string().min(1).default("./data/designs.json"),
    MESSAGES_FILE: z.string().min(1).default("./data/messages.json"),
    ASSETS_DIR: z.string().min(1).default("./data/assets"),
    MESH_PROVIDER: z.enum(["tripo", "mock"]).default("mock"),
    TRIPO_API_KEY: z.string().min(1).optional(),
    TRIPO_MODEL: z.string().min(1).default("v2.5-20250123"),
    /** A Google Apps Script web app that records each enquiry in a sheet and emails it. */
    CONTACT_WEBHOOK_URL: z
      .string()
      .url("Must be the web app URL ending in /exec")
      .refine((u) => u.startsWith("https://"), "Must be an https:// URL")
      .optional(),
    CONTACT_WEBHOOK_SECRET: z.string().min(24, "Must be at least 24 characters; generate with openssl rand -hex 24").optional(),
    /** Off until the operator has reviewed Google processing, access and external-copy retention. */
    CONTACT_FORWARDING_ENABLED: z.union([z.boolean(), z.enum(["true", "false"])]).default(false).transform((v) => v === true || v === "true"),
  })
  .superRefine((config, ctx) => {
    if (config.AI_PROVIDER === "gemini" && !config.GOOGLE_API_KEY)
      ctx.addIssue({
        code: "custom",
        path: ["GOOGLE_API_KEY"],
        message: "Required when AI_PROVIDER=gemini",
      });
    if (config.MESH_PROVIDER === "tripo" && !config.TRIPO_API_KEY)
      ctx.addIssue({
        code: "custom",
        path: ["TRIPO_API_KEY"],
        message: "Required when MESH_PROVIDER=tripo",
      });
    if (config.NODE_ENV === "production" && config.CORS_ORIGIN.split(",").some((o) => !o.trim().startsWith("https://")))
      ctx.addIssue({ code: "custom", path: ["CORS_ORIGIN"], message: "Production browser origins must use HTTPS." });
    if (config.CONTACT_FORWARDING_ENABLED && !config.CONTACT_WEBHOOK_URL)
      ctx.addIssue({ code: "custom", path: ["CONTACT_WEBHOOK_URL"], message: "Required when contact forwarding is enabled." });
    if (config.CONTACT_WEBHOOK_URL && !config.CONTACT_WEBHOOK_SECRET)
      ctx.addIssue({
        code: "custom",
        path: ["CONTACT_WEBHOOK_SECRET"],
        message: "Required when CONTACT_WEBHOOK_URL is set",
      });
  });
export type Environment = z.infer<typeof schema>;

/** Pure parser, also used by the headless suite. Never embeds input values in errors. */
export function parseEnvironment(raw: Record<string, unknown>): Environment {
  const blankAsUnset = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key,
      typeof value === "string" ? value.trim() || undefined : value,
    ]),
  );
  const result = schema.safeParse(blankAsUnset);
  if (!result.success)
    throw new Error(
      "Invalid environment configuration:\n" +
        result.error.issues
          .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
          .join("\n"),
    );
  return Object.freeze(result.data);
}
