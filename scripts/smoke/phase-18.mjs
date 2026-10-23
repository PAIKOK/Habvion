import { readFile } from "node:fs/promises";
import { signIn, SMOKE_USER } from "./helpers.mjs";

// `npm run dev` stores messages in messages.json; `npm run dev:mock` in mock-messages.json.
const FILES = ["messages.json", "mock-messages.json"].map((f) => new URL(`../../server/data/${f}`, import.meta.url));
const stored = async () => {
  const all = [];
  for (const file of FILES) {
    try {
      all.push(...JSON.parse(await readFile(file, "utf8")).messages);
    } catch {}
  }
  return all;
};

export default async function ({ page, url, check }) {
  // Found from the landing page, signed out.
  await page.context().clearCookies();
  await page.goto(url + "/", { waitUntil: "networkidle" });
  check("the footer links to the contact page", (await page.locator(".site-footer").getByRole("link", { name: "Contact us" }).count()) === 1);
  await page.locator(".site-header").getByRole("link", { name: "Contact", exact: true }).click();
  await page.waitForURL("**/contact");
  const form = page.getByRole("form", { name: "Contact form" });
  await form.waitFor();
  check("the page explains what to include", (await page.locator(".contact-intro").innerText()).includes("About a design?"));
  const trap = await page.locator(".contact-trap").boundingBox();
  check("the spam trap is off screen", !trap || trap.x + trap.width <= 0);
  check("every topic is offered", (await form.locator("select option").count()) === 8);
  check("no phone number is asked for", (await form.locator('input[type="tel"]').count()) === 0);
  check("the tab title names the page", (await page.title()).startsWith("Contact us · Habvion"));
  await page.screenshot({ path: "artifacts/phase-18-contact.png", fullPage: true });

  // The same rules as the server, before anything is sent.
  await form.getByRole("button", { name: /Send message/ }).click();
  check("an empty form marks each problem beside its field", /valid email/.test(await form.locator("#contact-email-error").innerText()) && /sentence|message/i.test(await form.locator("#contact-message-error").innerText()));
  check("there are no tick boxes on the contact form", (await form.locator('input[type="checkbox"]').count()) === 0);
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-invalid") === "true", null, { timeout: 3000 }).catch(() => {});
  check("…with a summary, and focus on the first one", /2 highlighted fields/.test(await form.getByRole("alert").innerText()) && (await page.evaluate(() => document.activeElement?.getAttribute("name"))) === "email");
  await page.screenshot({ path: "artifacts/phase-18-errors.png" });
  await form.getByLabel("Name").fill("Asha Rao");
  await form.getByLabel("Email").fill("asha@");
  await form.getByRole("button", { name: /Send message/ }).click();
  check("a bad email is caught", /valid email/.test(await form.locator("#contact-email-error").innerText()));
  await form.getByLabel("Email").fill("asha.smoke@example.com");
  await form.getByLabel("Your question is about").selectOption("costs");
  await form.getByLabel(/^Message/).fill("hi");
  await form.getByRole("button", { name: /Send message/ }).click();
  check("a one-word message is caught", /at least a sentence/.test(await form.locator("#contact-message-error").innerText()));
  check("…while the fixed email error is gone", (await form.locator("#contact-email-error").count()) === 0);

  // A real send.
  const text = `Smoke ${Date.now()}: does the estimate include GST for a 30×40 plot in Pune?`;
  await form.getByLabel(/^Message/).fill(text);
  check("the counter counts characters", (await form.innerText()).includes(`${text.length} / 4,000`));
  await form.getByRole("button", { name: /Send message/ }).click();
  await page.getByTestId("contact-done").waitFor();
  const reference = await page.getByTestId("contact-reference").innerText();
  check("a thank-you with a reference is shown", /^HB-[2-9A-HJ-NP-Z]{6}$/.test(reference), reference);
  const saved = (await stored()).find((m) => m.id === reference);
  check("the message is stored with what was typed", saved?.message === text && saved?.topic === "costs" && saved?.email === "asha.smoke@example.com" && !saved?.userId);
  await page.screenshot({ path: "artifacts/phase-18-sent.png" });
  await page.getByRole("button", { name: "Send another" }).click();
  check("send another keeps the name and email and clears the message", (await form.getByLabel("Name").inputValue()) === "Asha Rao" && (await form.getByLabel(/^Message/).inputValue()) === "");

  // Signed in: the name and email are filled in, and the account is attached.
  await signIn(page, url);
  await page.goto(url + "/contact", { waitUntil: "networkidle" });
  await page.waitForFunction((email) => document.querySelector('input[type="email"]')?.value === email, SMOKE_USER.email, { timeout: 10000 });
  check("a signed-in visitor's details are filled in", (await form.getByLabel("Name").inputValue()) === SMOKE_USER.name);
  await form.getByLabel(/^Message/).fill("Signed-in smoke question about my saved design.");
  await form.getByRole("button", { name: /Send message/ }).click();
  await page.getByTestId("contact-done").waitFor();
  const ref2 = await page.getByTestId("contact-reference").innerText();
  check("a signed-in message carries the account", !!(await stored()).find((m) => m.id === ref2)?.userId);

  // Narrow screens.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Send another" }).click();
  check("no sideways scrolling on a phone", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.screenshot({ path: "artifacts/phase-18-mobile.png", fullPage: true });
}
