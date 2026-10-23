import { UTM_KEYS, utmSchema, type Utm } from "@shared/contact/schema";

/** Standard campaign labels, held in memory only. Submission requires a separate form choice. */
function read(search: string): Utm {
  const params = new URLSearchParams(search), raw: Utm = {};
  for (const key of UTM_KEYS) {
    const values = params.getAll(`utm_${key}`);
    if (values.length === 1 && values[0]?.trim()) raw[key] = values[0].trim();
  }
  const parsed = utmSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}
const firstTouch = typeof window === "undefined" ? {} : read(window.location.search);
export function campaignTags(): Utm { return { ...firstTouch }; }
