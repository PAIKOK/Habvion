// Send one sample enquiry to Google Sheets + email: `npm run contact:test --workspace=server`.
import { env } from "./cliEnv.js";
import { createContactNotifier } from "../src/contact/notify.js";
import { newReference } from "../src/repositories/messages.js";

const notify = createContactNotifier(env);
if (!notify) {
  console.error("Not connected: set CONTACT_WEBHOOK_URL and CONTACT_WEBHOOK_SECRET in server/.env (see docs/CONTACT-GOOGLE-SHEETS.md).");
  process.exit(1);
}
const reference = newReference();
try {
  await notify({
    id: reference,
    name: "Test Enquiry",
    email: "test@example.com",
    topic: "general",
    message: "This is a test enquiry sent by `npm run contact:test`. You can delete this row.",
    createdAt: new Date().toISOString(),
  });
  console.log(`Sent ${reference}. Check the Enquiries tab in the sheet and the notification inbox.`);
} catch (e) {
  console.error(`Not sent: ${(e as Error).message}`);
  process.exit(1);
}
