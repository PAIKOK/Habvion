import { signIn } from "./helpers.mjs";

/** Site features: header, menu, search, floating actions, states, print, UTM. */
export default async function ({ page, url, check }) {
  await page.setViewportSize({ width: 1440, height: 900 });

  // Campaign tags arrive with the first page, and stay in memory only.
  await page.goto(url + "/?utm_source=instagram&utm_medium=social&utm_campaign=smoke-20", { waitUntil: "networkidle" });
  const storage = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.cookie);
  check("campaign tags are not written to storage or cookies", !/instagram|smoke-20/.test(storage));

  // Dark mode still toggles and is remembered.
  const html = page.locator("html");
  const before = await html.getAttribute("data-theme");
  await page.getByRole("button", { name: /Switch to (dark|light) mode/ }).click();
  check("dark mode toggles", (await html.getAttribute("data-theme")) !== before);
  await page.getByRole("button", { name: /Switch to (dark|light) mode/ }).click();

  // Sticky header and scroll progress.
  check("no scroll progress at the top", (await page.getByRole("progressbar").getAttribute("aria-valuenow")) === "0");
  await page.mouse.wheel(0, 1800);
  await page.waitForTimeout(400);
  const header = await page.locator(".site-header").boundingBox();
  check("the header stays at the top while scrolling", header?.y === 0, JSON.stringify(header));
  const progress = Number(await page.getByRole("progressbar").getAttribute("aria-valuenow"));
  check("the progress bar follows the scroll", progress > 10 && progress < 100, String(progress));

  // Back to top.
  const top = page.getByRole("button", { name: "Back to top" });
  await top.waitFor({ state: "visible" });
  check("a back-to-top button appears after scrolling", await top.evaluate((el) => el.classList.contains("visible")));
  await top.click();
  await page.waitForFunction(() => window.scrollY < 5, null, { timeout: 5000 }).catch(() => {});
  check("…and returns to the top", (await page.evaluate(() => window.scrollY)) < 5);

  // Hover states.
  const card = page.locator(".feature-card").first();
  await card.scrollIntoViewIfNeeded();
  const flat = await card.evaluate((el) => getComputedStyle(el).boxShadow);
  await card.hover();
  await page.waitForTimeout(300);
  check("cards respond to hover", (await card.evaluate((el) => getComputedStyle(el).boxShadow)) !== flat);

  // FAQ accordion.
  const faq = page.locator("#faq");
  await faq.scrollIntoViewIfNeeded();
  const first = faq.locator("details").first();
  check("the FAQ starts closed", !(await first.evaluate((d) => d.open)));
  await first.locator("summary").focus();
  await page.keyboard.press("Enter");
  check("an answer opens from the keyboard", await first.evaluate((d) => d.open));
  await faq.locator("details").nth(1).locator("summary").click();
  check("opening another closes the first", !(await first.evaluate((d) => d.open)) && (await faq.locator("details").nth(1).evaluate((d) => d.open)));
  await page.screenshot({ path: "artifacts/phase-20-faq.png" });

  // Floating contact.
  const ask = page.getByTestId("floating-contact");
  check("a floating 'Ask us' button is on the page", await ask.isVisible());
  await page.screenshot({ path: "artifacts/phase-20-floating.png" });

  // Search.
  await page.keyboard.press("Control+k");
  const search = page.getByRole("dialog", { name: "Search the site" });
  await search.waitFor();
  check("Ctrl K opens search, focused on the box", await page.getByRole("combobox").evaluate((el) => el === document.activeElement));
  await page.keyboard.type("refund");
  check("search finds the refund policy", (await search.getByRole("option").first().innerText()).includes("Refund Policy"));
  await page.keyboard.press("Escape");
  check("Escape closes search", !(await search.isVisible()));
  await page.getByRole("button", { name: "Search the site" }).click();
  await page.keyboard.type("bungalow");
  await search.getByRole("option", { name: /Garden Bungalow/ }).waitFor({ timeout: 5000 });
  await page.screenshot({ path: "artifacts/phase-20-search.png" });
  await page.keyboard.press("Enter");
  await page.waitForURL("**/demos/garden-bungalow");
  check("Enter opens the chosen result", new URL(page.url()).pathname === "/demos/garden-bungalow");
  await page.locator(".floating-actions").waitFor({ state: "detached", timeout: 5000 }).catch(() => {});
  check("full-screen viewers have no floating buttons", (await page.locator(".floating-actions").count()) === 0);
  // Back to the landing page inside the app, so the arrival tags (kept in memory) survive.
  await page.goBack();
  await page.waitForURL((u) => u.pathname === "/");
  await page.locator("#faq").waitFor();
  await page.keyboard.press("/");
  await page.keyboard.type("how do I delete my data");
  check("questions are searchable too", (await page.getByRole("option").first().innerText()).includes("download or delete"));
  await page.keyboard.press("Escape");

  // UTM: the tags captured on arrival ride along as hidden fields on the contact form.
  await page.getByTestId("floating-contact").click();
  await page.waitForURL("**/contact");
  await page.getByRole("form", { name: "Contact form" }).waitFor();
  const hidden = await page.locator('form input[type="hidden"]').evaluateAll((els) => Object.fromEntries(els.map((e) => [e.name, e.value])));
  check("the contact form carries the campaign tags as hidden fields", hidden.utm_source === "instagram" && hidden.utm_campaign === "smoke-20", JSON.stringify(hidden));
  check("the floating button hides on the contact page", (await page.getByTestId("floating-contact").count()) === 0);
  const form = page.getByRole("form", { name: "Contact form" });
  await form.getByLabel("Email").fill("utm.smoke@example.com");
  await form.getByLabel(/^Message/).fill("Smoke 20: which link brought me here?");
  const sent = page.waitForResponse((r) => r.url().endsWith("/api/contact") && r.request().method() === "POST");
  await form.getByRole("button", { name: /Send message/ }).click();
  const response = await sent,
    body = response.request().postDataJSON();
  check("the message is accepted", response.status() === 201, `${response.status()} ${await response.text()}`);
  check("…and sends them with the message", body.utm?.source === "instagram" && body.utm?.medium === "social");
  await page.getByTestId("contact-done").waitFor();

  // Copy to clipboard.
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const copy = page.locator(".contact-reference-row .copy-button");
  await copy.click();
  check("the reference can be copied", (await page.evaluate(() => navigator.clipboard.readText())) === (await page.getByTestId("contact-reference").innerText()));
  check("…and the button says so", (await copy.innerText()).includes("Copied"));
  await page.screenshot({ path: "artifacts/phase-20-copied.png" });

  // Footer metadata.
  const meta = await page.locator(".footer-meta").innerText();
  check("the footer says when the site and policies were updated", /Site last updated \d+ \w+ \d{4}/.test(meta) && meta.includes("Policies updated"), meta);

  // Print.
  await page.emulateMedia({ media: "print" });
  const hiddenInPrint = await page.evaluate(() => [".header-nav", ".floating-actions", ".footer-links"].every((s) => { const el = document.querySelector(s); return !el || getComputedStyle(el).display === "none"; }));
  check("printing hides navigation and floating buttons", hiddenInPrint);
  check("printing uses a white page", (await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === "rgb(255, 255, 255)");
  await page.goto(url + "/privacy", { waitUntil: "networkidle" });
  await page.pdf({ path: "artifacts/phase-20-print.pdf", format: "A4" }).catch(() => {});
  await page.screenshot({ path: "artifacts/phase-20-print.png", fullPage: true });
  await page.emulateMedia({ media: "screen" });

  await signIn(page, url);

  // Mobile menu.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url + "/", { waitUntil: "networkidle" });
  const menuButton = page.getByRole("button", { name: "Open menu" });
  check("phones get a menu button", await menuButton.isVisible());
  check("the desktop links are hidden on phones", !(await page.locator(".header-nav .desktop-link").first().isVisible()));
  await menuButton.click();
  const menu = page.locator("#mobile-menu");
  check("the menu opens and says so", (await menu.isVisible()) && (await page.getByRole("button", { name: "Close menu" }).getAttribute("aria-expanded")) === "true");
  check("focus moves into the menu", await menu.evaluate((m) => m.contains(document.activeElement)));
  for (const name of ["How it works", "Demo homes", "Questions", "Contact us", "My designs", "Your account and data", "Sign out"]) check(`the menu offers ${name}`, (await menu.getByRole(name === "Sign out" ? "button" : "link", { name, exact: true }).count()) === 1);
  await page.screenshot({ path: "artifacts/phase-20-menu.png" });
  await page.keyboard.press("Escape");
  check("Escape closes the menu and returns focus", !(await menu.isVisible()) && (await page.getByRole("button", { name: "Open menu" }).evaluate((b) => b === document.activeElement)));
  await page.getByRole("button", { name: "Open menu" }).click();
  await menu.getByRole("link", { name: "Contact us" }).click();
  await page.waitForURL("**/contact");
  await menu.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
  check("choosing a page closes the menu", !(await menu.isVisible()));
  check("no sideways scrolling with the new header", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));

  // Skeletons while designs load.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("**/api/designs", async (route) => {
    await new Promise((r) => setTimeout(r, 1200));
    await route.continue();
  });
  await page.goto(url + "/designs");
  const skeleton = page.getByRole("status", { name: "Loading your designs" });
  await skeleton.waitFor({ timeout: 3000 }).catch(() => {});
  check("designs show placeholder cards while loading", await skeleton.isVisible());
  await page.screenshot({ path: "artifacts/phase-20-skeleton.png" });
  await page.unroute("**/api/designs");
}
