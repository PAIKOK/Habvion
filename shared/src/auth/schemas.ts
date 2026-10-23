import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254);
/** Length over composition rules: at least 10 characters, nothing else demanded. */
export const passwordSchema = z.string().min(10, "Use at least 10 characters.").max(200, "That password is too long.");
/** The sign-up box: agreeing to the Terms and Privacy Policy, and confirming age 18+. */
export const AGREEMENT_REQUIRED = "Tick the box to confirm you are 18 or older, accept the Terms, and consent to account data processing.";
export const signupSchema = z.object({
  name: z.string().trim().max(80).optional().transform((v) => v || "Home planner"),
  email: emailSchema,
  password: passwordSchema,
  consent: z.literal(true, { error: AGREEMENT_REQUIRED }),
});
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password.").max(200) });
/** `consent` is required only when the Google sign-in would create a new account. */
export const googleSignInSchema = z.object({ credential: z.string().min(20).max(4096), consent: z.literal(true).optional() });
/** Deleting an account: the password if it has one, otherwise the word DELETE. */
export const deleteAccountSchema = z.object({ password: z.string().max(200).optional(), confirm: z.string().max(20).optional() });
