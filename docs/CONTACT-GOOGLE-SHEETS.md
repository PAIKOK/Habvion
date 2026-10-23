# Contact enquiries → Google Sheets + email

Every enquiry sent from `/contact` is saved by the server first (so nothing is ever lost),
then passed to a small **Google Apps Script** attached to your sheet. The script:

- adds a row to an **Enquiries** tab (Received, Reference, Name, Email, Phone, Topic, Message, Signed in),
- emails the enquiry to `NOTIFY_TO` (set in the script). Pressing **Reply** in that email answers the visitor directly.

The email comes from the Google account that owns the script. Free Gmail accounts can
send about 100 of these a day.

## One-time setup (about 10 minutes)

The secret is already generated: it's the `CONTACT_WEBHOOK_SECRET` line in `server/.env`.

1. **Open the sheet** and choose **Extensions → Apps Script**.
2. **Paste the script.** Delete everything in `Code.gs` and paste in
   `integrations/google-sheets/Code.gs` from this project. Check `NOTIFY_TO` at the top,
   then press **Save** (the disk icon).
3. **Add the secret.** Click **Project Settings** (the gear icon on the left). Under
   **Script properties**, choose **Add script property**:
   - Property: `WEBHOOK_SECRET`
   - Value: the text after `CONTACT_WEBHOOK_SECRET=` in `server/.env`. Copy all of it,
     with no spaces.

   Then press **Save script properties**.
4. **Run setup once.** Go back to **Editor** (the `< >` icon), pick `setup` in the
   function list at the top, and press **Run**. Google asks for permission:
   **Review permissions** → choose your account → **Advanced** →
   **Go to (project name) (unsafe)** → **Allow**. That warning appears because you wrote
   this script yourself and Google hasn't reviewed it. An **Enquiries** tab appears and
   a test email arrives.
5. **Deploy as a web app.** Choose **Deploy → New deployment**, click the gear next to
   *Select type*, and pick **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**. The server isn't signed in to Google, and the secret is
     what keeps strangers out.

   Press **Deploy** and copy the **Web app URL**. It ends in `/exec`.
6. **Give the app the URL.** In `server/.env`, paste it after `CONTACT_WEBHOOK_URL=`.
7. **Restart the server**, then test from the project folder:

   ```
   npm run contact:test --workspace=server
   ```

   It prints `Sent HB-…` and a test row and email appear. If it fails, it says why
   (wrong secret, deployment not set to "Anyone", wrong URL…).

## Changing things later

- **Different or extra recipients:** edit `NOTIFY_TO` in the script, then
  **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**. The URL stays the same.
- **Any script edit** needs that same "new version" step before the live web app uses it.
- **Turning it off:** blank `CONTACT_WEBHOOK_URL` in `server/.env`. Enquiries are still
  saved, and `npm run messages --workspace=server` lists them.

## Safety

- The secret is kept only in `server/.env` (not in git) and in the script's properties,
  never in code. If it leaks, generate a new one (`openssl rand -hex 24`) and update both.
- Requests without the right secret are refused and nothing is written.
- Cells that would start with `=`, `+`, `-` or `@` are stored as plain text, so a visitor
  can't plant a formula in your sheet.
- If Google is down or misconfigured, the visitor still sees "Thank you", the enquiry is
  still saved by the server, and the server log names the reference that wasn't sent.
