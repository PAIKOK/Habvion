import { signIn } from "./helpers.mjs";

/** Compliance: consent, policies, business details, rights, accessibility. */
export default async function ({ page, url, check }) {
  // A true first visit, in a fresh browser context with nothing stored.
  const fresh = await page.context().browser().newContext({ viewport: { width: 1440, height: 900 } });
  const first = await fresh.newPage();
  const googleHits = [];
  await first.route("https://accounts.google.com/**", (route) => {
    googleHits.push(route.request().url());
    return route.fulfill({ body: "/* stand-in */", contentType: "text/javascript" });
  });
  // Pretend Google sign-in is configured, so its consent gate can be seen working.
  await first.route("**/api/auth/config", (route) => route.fulfill({ json: { googleClientId: "smoke.apps.googleusercontent.com" } }));
  await first.goto(url + "/", { waitUntil: "networkidle" });
  const banner = first.getByTestId("cookie-banner");
  check("a first visit shows the cookie banner", await banner.isVisible());
  const choices = banner.getByRole("button");
  const sizes = await Promise.all([0, 1].map(async (i) => (await choices.nth(i).boundingBox()).height));
  const classes = await Promise.all([0, 1].map((i) => choices.nth(i).getAttribute("class")));
  check("'Essential only' and 'Accept all' carry equal weight", (await choices.count()) === 2 && classes[0] === classes[1] && Math.abs(sizes[0] - sizes[1]) < 1, classes.join(" | "));
  await first.screenshot({ path: "artifacts/phase-19-banner.png" });
  await banner.getByRole("button", { name: "Essential only" }).click();
  check("the choice closes the banner", (await banner.count()) === 0);
  await first.reload({ waitUntil: "networkidle" });
  check("…and is remembered", (await first.getByTestId("cookie-banner").count()) === 0);

  // Google's script stays away until allowed.
  await first.goto(url + "/login", { waitUntil: "networkidle" });
  check("with 'Essential only', Google's script does not load", googleHits.length === 0);
  check("…a plain 'Continue with Google' button is shown instead", await first.getByTestId("google-consent").isVisible());
  await first.goto(url + "/signup", { waitUntil: "networkidle" });
  check("on sign-up, Google is locked until the agreement box is ticked", await first.getByTestId("google-locked").isVisible());
  await first.getByTestId("signup-consent").check();
  await first.getByTestId("google-consent").click();
  await first.waitForTimeout(500);
  check("clicking it loads Google's script", googleHits.length === 1, googleHits.join(", "));
  await fresh.close();

  // Policies and business details from every public page.
  await page.goto(url + "/", { waitUntil: "networkidle" });
  const footer = page.locator(".site-footer");
  for (const name of ["Contact us", "Privacy", "Terms", "Cookies", "Refunds", "Credits"]) check(`the footer links to ${name}`, (await footer.getByRole("link", { name, exact: true }).count()) === 1);
  check("the footer can reopen cookie settings", (await footer.getByRole("button", { name: "Cookie settings" }).count()) === 1);
  check("the landing page no longer claims Vastu-aware planning", !(await page.locator("body").innerText()).includes("Vastu-aware planning"));
  const pages = { "/privacy": ["Privacy Policy", "Data Protection Board", "18 or older", "Gemini"], "/terms": ["Terms of Service", "not construction drawings", "18 or older"], "/cookies": ["Cookie Policy", "hb_session", "Google Sign-In"], "/refunds": ["Refund Policy", "no hidden fees"], "/credits": ["Credits", "CC BY 4.0"] };
  for (const [path, words] of Object.entries(pages)) {
    await page.goto(url + path, { waitUntil: "networkidle" });
    const text = await page.locator("main").innerText();
    const missing = words.filter((w) => !text.includes(w));
    check(`${path} explains what it should`, missing.length === 0, missing.join(", "));
  }
  check("credits name every 3D model's author", (await page.getByTestId("credits").locator("tbody tr").count()) >= 9);
  await page.screenshot({ path: "artifacts/phase-19-credits.png", fullPage: true });
  await page.goto(url + "/privacy", { waitUntil: "networkidle" });
  await page.screenshot({ path: "artifacts/phase-19-privacy.png" });
  await page.locator(".site-footer").getByRole("button", { name: "Cookie settings" }).click();
  check("cookie settings reopen with a Google switch", await page.getByLabel("Allow Google Sign-In").isVisible());
  await page.getByRole("button", { name: "Save choices" }).click();

  // Keyboard and contrast.
  await page.goto(url + "/", { waitUntil: "networkidle" });
  await page.keyboard.press("Tab");
  check("the first Tab reaches 'Skip to content'", (await page.evaluate(() => document.activeElement?.textContent?.trim())) === "Skip to content");
  await page.keyboard.press("Enter");
  check("…which moves focus to the page", await page.evaluate(() => document.activeElement?.id === "main"));
  const muted = await page.locator(".hero-description").evaluate((el) => getComputedStyle(el).color);
  check("secondary text uses the darker, readable grey", muted === "rgb(106, 109, 98)", muted);

  // Download and delete, as a throwaway account.
  const email = `p19-${Date.now()}@homebuilder.test`;
  await page.context().clearCookies();
  const made = await page.request.post(`${url}/api/auth/signup`, { data: { name: "Delete Me", email, password: "a long enough password", consent: true } });
  check("setup: a throwaway account", made.ok());
  await page.goto(url + "/", { waitUntil: "networkidle" });
  await page.locator(".site-header").getByRole("link", { name: "Delete Me" }).click();
  await page.waitForURL("**/account");
  const heading = page.getByRole("heading", { name: "Your account and data" });
  await heading.waitFor({ timeout: 10000 }).catch(() => {});
  check("the name in the header opens the account page", await heading.isVisible());
  const exp = await page.request.get(`${url}/api/auth/export`);
  const data = exp.ok() ? await exp.json() : null;
  check("'Download my data' returns the account as a file", data?.account?.email === email && /attachment/.test(exp.headers()["content-disposition"] ?? ""));
  await page.getByRole("button", { name: "Delete my account…" }).click();
  await page.getByLabel("Enter your password to confirm").fill("not the password");
  await page.getByRole("button", { name: "Delete everything" }).click();
  check("a wrong password is refused", /incorrect/.test(await page.getByRole("alert").innerText()));
  await page.screenshot({ path: "artifacts/phase-19-account.png" });
  await page.getByLabel("Enter your password to confirm").fill("a long enough password");
  await page.getByRole("button", { name: "Delete everything" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  check("after deleting, the visitor is signed out", (await (await page.request.get(`${url}/api/auth/me`)).json()).user === null);
  const relogin = await page.request.post(`${url}/api/auth/login`, { data: { email, password: "a long enough password" } });
  check("…and the account cannot log in", relogin.status() === 401, `${relogin.status()} ${await relogin.text()}`);

  // Phones.
  await signIn(page, url);
  await page.setViewportSize({ width: 360, height: 780 });
  for (const path of ["/privacy", "/cookies", "/account"]) {
    await page.goto(url + path, { waitUntil: "networkidle" });
    check(`${path} has no sideways scrolling on a phone`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  }
  await page.screenshot({ path: "artifacts/phase-19-mobile.png", fullPage: true });
}
