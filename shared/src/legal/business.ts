import { APP_NAME } from "../version";

/**
 * The business behind the site. Shown in the footer, the contact page and the legal
 * pages. Fill these in before going live — a field left `null` is simply not shown,
 * so the site never displays an invented name, address or number.
 */
export const BUSINESS = {
  /** Trading name, as visitors know it. */
  brand: APP_NAME,
  /** Registered legal name, e.g. "Habvion Technologies Private Limited". */
  legalName: "Jyothika K S" as string | null,
  /** Registered postal address, one line. */
  address: "Bengaluru, India" as string | null,
  /** Public email for questions and privacy requests. */
  email: "jyothikaks023@gmail.com" as string | null,
  phone: null as string | null,
  /** GSTIN, CIN or similar registration numbers, if any. */
  registration: null as string | null,
  /** Designated privacy/grievance contact. This does not claim appointment as a statutory DPO. */
  grievanceOfficer: "Poojesh K S (poojesh32@gmail.com)" as string | null,
  /** City whose courts handle disputes, e.g. "Bengaluru". */
  courtsCity: null as string | null,
};

/** Missing operator details are a launch blocker, not a reason to invent a legal identity. */
export function businessReadinessIssues() {
  const required = ["legalName", "address", "email", "grievanceOfficer"] as const;
  const missing: string[] = required.filter((key) => !BUSINESS[key]?.trim());
  if (BUSINESS.email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(BUSINESS.email) || /\.(example|invalid|test)$/i.test(BUSINESS.email))) missing.push("valid public email");
  return missing;
}
export function assertBusinessConfigured() {
  const missing = businessReadinessIssues();
  if (missing.length) throw new Error(`Production launch blocked: complete public business details (${missing.join(", ")}) in shared/src/legal/business.ts, then obtain a policy review for the actual operation.`);
}

/** Bump when a policy changes in substance; sign-ups record the version they agreed to. */
export const POLICY_VERSION = "2026-10-22";
export const POLICY_UPDATED = "22 October 2026";
