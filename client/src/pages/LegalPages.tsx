import { useEffect, useState, type ReactNode } from "react";
import { Skeleton } from "../ui/Skeleton";
import { Link } from "react-router-dom";
import { BUSINESS, POLICY_UPDATED, businessReadinessIssues } from "@shared/legal/business";
import { useAuthStore } from "../state/authStore";
import { Header } from "../ui/Header";
import { SiteFooter } from "../ui/SiteFooter";
import { openCookieSettings } from "../ui/CookieBanner";

const B = BUSINESS.brand;
/** How people reach us: the email if one is set, and always the contact form. */
function ReachUs() {
  return (
    <>
      {BUSINESS.email && (
        <>
          email <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a> or{" "}
        </>
      )}
      use our <Link to="/contact">contact form</Link>
    </>
  );
}
function Legal({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  useEffect(() => {
    const before = document.title;
    document.title = `${title} · ${B}`;
    window.scrollTo(0, 0);
    return () => void (document.title = before);
  }, [title]);
  return (
    <>
      <Header />
      <main id="main" tabIndex={-1} className="legal-page section-shell">
        <p className="eyebrow">LEGAL</p>
        <h1>{title}</h1>
        <p className="legal-updated">Last updated {POLICY_UPDATED}</p>
        <p className="legal-intro">{intro}</p>
        {businessReadinessIssues().length > 0 && <p className="business-pending" role="note">Draft for a local prototype. The legal operator name, postal address, public privacy contact and grievance contact must be supplied and these policies reviewed against the actual business before public launch. Do not submit live sensitive information.</p>}
        <div className="legal-body">{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}

export function PrivacyPage() {
  return (
    <Legal title="Privacy Policy" intro={`${B} is a home-planning prototype. This notice describes the data flows implemented in this build, not a certification of legal compliance. Statutory rights depend on the laws and provisions currently in force.`}>
      <h2>Who is responsible</h2>
      <p>{BUSINESS.legalName ?? "The operator's legal identity has not yet been published"}.{BUSINESS.address && ` Address: ${BUSINESS.address}.`} For privacy enquiries, <ReachUs /> and choose "Privacy or my data".{BUSINESS.grievanceOfficer && ` The designated grievance contact is ${BUSINESS.grievanceOfficer}.`}</p>
      <h2>What the app processes</h2>
      <ul>
        <li><strong>Account:</strong> email, optional display name, password hash for email sign-in, or Google subject identifier/email for Google sign-in; account timestamps and the accepted policy version. We do not keep a plaintext password or automatically retain Google's full profile name for new accounts.</li>
        <li><strong>Designs:</strong> plot dimensions, rooms, finishes, furniture, imported item information and sharing settings. Free-text names, prompts and links can contain personal information: avoid home addresses, credentials and sensitive details.</li>
        <li><strong>Enquiries:</strong> email, optional name, topic, message, reference, consent time/version and account link when signed in. New forms do not collect phone numbers.</li>
        <li><strong>Optional campaign attribution:</strong> the standard source, medium, campaign, term and content labels in your arrival URL are held in memory, not cookies or browser storage. They are attached to a contact enquiry only if you separately tick the optional attribution box. They can then be linked to that enquiry's email. Do not put personal information in campaign labels. Other query parameters and advertising click IDs are not collected by this feature.</li>
        <li><strong>Technical data:</strong> session cookies, display/privacy preferences and temporary anti-abuse processing. Your hosting or CDN provider may independently log IP addresses and request URLs; its configuration and retention need operator review.</li>
      </ul>
      <p>No third-party analytics or advertising SDK is included in the audited application. This statement does not cover scripts subsequently added by a deployment host or operator. No marketing subscription is created by the contact or account consent boxes.</p>
      <h2>Optional services and sharing</h2>
      <ul>
        <li><strong>Google sign-in:</strong> its script does not load until you permit it or deliberately choose Google sign-in. Google may process technical information and set its own cookies. Email sign-in is available separately.</li>
        <li><strong>Google Gemini:</strong> only when configured and after the assistant's separate permission is given, the app sends your request, relevant room/layout description and recent assistant messages. The account profile and password are not added. Demo/mock mode makes no external AI request.</li>
        <li><strong>Tripo:</strong> only when configured and after photo-processing permission and a rights confirmation, the photo address is sent for model generation. Demo mode does not send it externally. Never submit identifying or sensitive photos.</li>
        <li><strong>Google Sheets/email:</strong> only if the operator explicitly enables the configured forwarding workflow, contact details/messages are copied there for support. Campaign attribution is not forwarded. Deleting the app's copy does not delete those external copies.</li>
        <li><strong>Product links:</strong> the server visits a page you request to obtain product metadata. Product photos are not automatically embedded in your browser.</li>
        <li><strong>Share links:</strong> anyone given a live share link can view that design. Newly generated model files require the owner session or a valid share link for that owner's referenced model. Do not share confidential designs. A recipient may keep a copy that the app cannot recall.</li>
      </ul>
      <p>Provider terms, processing regions, retention and possible use of inputs vary by provider/product tier. These must be reviewed before enabling live processing; this prototype does not promise India-only storage or that a provider never uses inputs to improve its products.</p>
      <h2>Retention and deletion</h2>
      <ul>
        <li>Active accounts and saved designs remain until account deletion or another operator-approved retention action.</li>
        <li>New enquiries receive an expiry 90 days after receipt. A cleanup runs at startup and daily while the server is running, so physical removal is not instantaneous at the expiry time. Older records without an expiry require operator review rather than silent deletion under a new rule.</li>
        <li>Deleting an account removes active profile/design records, share links, linked enquiries and generated files with recorded ownership. Minimal revocation markers prevent deleted files from becoming accessible again.</li>
        <li>Anonymous enquiries, older unowned files, backups, provider copies, Google Sheets rows and emails require separate verification and handling. Previously downloaded or cached copies cannot be recalled. Do not interpret the deletion button as erasing every copy everywhere.</li>
      </ul>
      <h2>Your available controls</h2>
      <p>Use <Link to="/account">Your account</Link> to export active profile/design/enquiry data and an owned-file list, or request active-account deletion. Model binaries, password hashes, anonymous messages and external/backup copies are not all included in that JSON. Correct designs in the editor; <ReachUs /> for other access, correction, deletion, nomination or grievance requests and appropriate identity verification.</p>
      <p>You can decline campaign attribution without losing the contact form, and untick external-AI permission to stop future requests. Change Google choices through <button type="button" className="link-button" onClick={openCookieSettings}>Cookie settings</button>. Already-loaded third-party code may require a reload to stop completely; the app cannot delete another domain's cookies or recall already-sent data.</p>
      <h2>Indian legal review and children</h2>
      <p>The DPDP Act, 2023 and Rules, 2025 have phased commencement; the core processing/rights framework is scheduled to commence in May 2027. Do not assume every DPDP right or Data Protection Board remedy is already operational on the date of this notice. The operator must verify the current notifications, applicable IT/SPDI and consumer obligations, grievance procedures, processor contracts and security arrangements with qualified counsel before launch.</p>
      <p>The service is intended for adults aged 18 or older. The checkbox is a self-declaration, not verified age assurance or verifiable parental consent. An adult may contact us about a child's data; this app is not designed to onboard children.</p>
      <h2>Security and changes</h2>
      <p>The application hashes passwords, uses HTTP-only SameSite sign-in cookies (Secure in production), scopes data access to the owner, and applies validation and rate limits. These measures are not a guarantee against a breach. HTTPS, access control, encryption/backups, security logging, incident response and deletion of external copies remain deployment/operator responsibilities.</p>
      <p>Material changes should be reflected in the notice date/version and, where required, renewed permission. This draft must be checked against the actual deployed service, not simply published unchanged.</p>
    </Legal>
  );
}

export function TermsPage() {
  return (
    <Legal title="Terms and Conditions" intro={`These terms apply when you use ${B}. Account creation requires explicit acceptance; enforceability and the actual operator details must be reviewed before launch. Please read the section on estimates carefully.`}>
      <h2>The service</h2>
      <p>
        {B} lets you lay out a home on your plot, see it in 3D, and get an indicative cost estimate. This build contains no checkout or subscription-billing flow; see our <Link to="/refunds">Refund Policy</Link>.
      </p>

      <h2>Estimates and designs are not professional advice</h2>
      <p>
        Plans, measurements, structural suggestions and cost estimates are <strong>indicative only</strong>. They are not construction drawings, not structural or architectural advice, and not a quotation. Rates are mid-range
        figures before GST and change by city and over time. Before you build or spend money, have your plans checked by a licensed architect or engineer, get local quotations, and get the approvals your
        local authority requires.
      </p>

      <h2>The design assistant</h2>
      <p>The assistant uses AI. Every change it makes is checked against the same rules as your own edits, but it can still misunderstand you or be wrong. Review its changes before relying on them.</p>

      <h2>Your account</h2>
      <ul>
        <li>You must be 18 or older.</li>
        <li>Keep your password private; you're responsible for what happens under your account.</li>
        <li>You can delete your account at any time from <Link to="/account">Your account</Link>.</li>
      </ul>

      <h2>Your designs and content</h2>
      <p>
        You retain rights you lawfully hold in your original inputs. You give us the limited permission needed to host/process them and display them as requested. AI output may not be unique, protectable or cleared of third-party rights; no exclusive ownership is promised. Imported product names, photos and brands belong to their owners; import only
        pages you're allowed to use for personal planning.
      </p>

      <h2>Fair use</h2>
      <p>Don't misuse the service: no attempts to break in, overload it, scrape it, reach other people's data, or use the import feature to fetch content you have no right to.</p>

      <h2>Availability and liability</h2>
      <p>
        We work to keep {B} running and your data safe, but we provide it "as is" and can't promise it will always be available or error-free. To the extent the law allows, we aren't liable for indirect losses, or
        for decisions made on the basis of designs or estimates from the service. Nothing here limits rights you have under Indian consumer law.
      </p>

      <h2>Ending</h2>
      <p>You can stop at any time. We may suspend accounts that break these terms; if we do, we'll tell you why and let you download your designs where we can.</p>

      <h2>Law</h2>
      <p>These terms are governed by the laws of India{BUSINESS.courtsCity ? `, and disputes go to the courts of ${BUSINESS.courtsCity}` : ""}.</p>

      <h2>Contact</h2>
      <p>
        Questions about these terms? <ReachUs />.
      </p>
    </Legal>
  );
}

export function CookiesPage() {
  const cookieName = useAuthStore((s) => s.authCookieName);
  return <Legal title="Cookie Policy" intro="This build uses necessary sign-in storage, a display preference and a privacy choice. It does not load an advertising or third-party analytics SDK. Optional Google sign-in is off until you allow it.">
    <h2>Storage inventory</h2>
    <table className="legal-table"><thead><tr><th>Name/type</th><th>Purpose</th><th>Duration</th></tr></thead><tbody>
      <tr><td><code>{cookieName || "hb_session"}</code> — cookie</td><td>Necessary sign-in session. HTTP-only and SameSite=Lax; Secure is required in production.</td><td>Up to 7 days, or until sign-out.</td></tr>
      <tr><td><code>hb-theme</code> — local storage</td><td>The display preference you choose.</td><td>Until you change it or clear browser storage.</td></tr>
      <tr><td><code>hb-consent</code> — local storage</td><td>Remembers whether optional Google sign-in is allowed; no visitor identifier is added.</td><td>Up to 180 days, then the saved approval is treated as expired on reload.</td></tr>
    </tbody></table>
    <h2>Optional Google sign-in</h2><p>The Google script loads only after permission or a deliberate request to continue with Google. Google may process your IP/device information and set its own cookies. See <a href="https://policies.google.com/technologies/cookies" target="_blank" rel="noopener noreferrer">Google's cookie information</a>. Essential-only choices do not disable email sign-in.</p>
    <h2>Campaign labels are not cookies</h2><p>Standard UTM labels from the arrival URL are held in page memory only, not local/session storage or cookies. The contact form has a separate optional choice before attaching those labels to an enquiry. Site-search terms are filtered locally and are not sent to an external search/analytics service.</p>
    <h2>Change your choice</h2><p><button type="button" className="button button-outline" onClick={openCookieSettings}>Open cookie settings</button></p><p>Turning Google off prevents future loads by the app. Save your work and reload if its code was already loaded. Your browser controls Google's own cookies; the app cannot erase another domain's storage. Additional analytics, advertisements or embeds must not be introduced under this notice without a new assessment and appropriate prior permission.</p>
  </Legal>;
}

export function RefundsPage() {
  return <Legal title="Refund Policy" intro="The audited build has no checkout, card collection or subscription-billing functionality. Building-budget amounts shown in a design are estimates, not payment requests from this site.">
    <h2>Current payment status</h2><p>No in-app payment flow is implemented. This is not a promise that every future service will be free. The operator must confirm its actual commercial arrangements before publishing this policy.</p>
    <h2>If you believe you were charged</h2><p><ReachUs /> with the date, amount and transaction reference. Do not send a full card number, bank password, PIN or OTP. Do not assume an off-site payment request is authorised merely because it uses this brand name.</p>
    <h2>Before enabling paid services</h2><p>Publish the actual merchant identity, total prices/taxes, cancellation and refund eligibility, request procedure, processing timeframes and payment provider. Obtain appropriate agreement before purchase. Nothing here excludes mandatory consumer rights or acts as a blanket no-refund clause.</p>
    <h2>Construction costs are separate</h2><p>Indicative building costs are not invoices or supplier quotations. Agreements with architects, contractors or suppliers must be assessed separately.</p>
  </Legal>;
}

type Credit = { file: string; title: string; author: string; source: string; licence: string };
/** Attribution for every third-party asset, read from the licence file shipped with the models. */
export function CreditsPage() {
  const [credits, setCredits] = useState<Credit[] | null>(null);
  useEffect(() => {
    fetch("/models/LICENSES.md")
      .then((r) => (r.ok ? r.text() : ""))
      .then((md) => {
        const link = (cell: string) => cell.match(/\((https?:[^)]+)\)/)?.[1] ?? "";
        const rows = md
          .split("\n")
          .filter((l) => /^\|\s*`?[\w-]+\.(glb|gltf)/.test(l))
          .map((l) => l.split("|").slice(1, -1).map((c) => c.trim()))
          .map(([file = "", title = "", author = "", source = "", licence = ""]) => ({ file: file.replace(/`/g, ""), title, author, source: link(source) || source, licence: licence.replace(/\[([^\]]+)\]\([^)]+\)/, "$1") }));
        setCredits(rows);
      })
      .catch(() => setCredits([]));
  }, []);
  return (
    <Legal title="Credits" intro="The UI uses local SVG drawings/icons and fonts installed on your device. The original sources for the bundled 3D models declare CC BY 4.0 licences; creator metadata was checked on 22 October 2026. Attribution is listed below. Source declarations do not independently prove ownership or clear trademarks, design rights or publicity rights.">
      <h2>3D models</h2>
      {credits === null ? (
        <div role="status" aria-busy="true" aria-label="Loading credits" className="skeleton-lines">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} height={18} width={`${92 - (i % 3) * 9}%`} />
          ))}
        </div>
      ) : credits.length === 0 ? (
        <p>The credits list could not be loaded. It is also included with the site at /models/LICENSES.md.</p>
      ) : (
        <table className="legal-table" data-testid="credits">
          <thead>
            <tr>
              <th>Model</th>
              <th>Author</th>
              <th>Licence</th>
            </tr>
          </thead>
          <tbody>
            {credits.map((c) => (
              <tr key={c.file}>
                <td>{c.source.startsWith("http") ? <a href={c.source} target="_blank" rel="noreferrer">{c.title}</a> : c.title}</td>
                <td>{c.author}</td>
                <td>
                  <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
                    {c.licence || "CC BY 4.0"}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p>Models were optimised (simplified, textures resized) and are scaled to fit each catalog item. Further rotations and source/file details are listed in /models/LICENSES.md. Branded vehicle/game-derived assets need operator rights review before public/commercial use; a Creative Commons copyright licence does not clear every other right.</p>
      <h2>Fonts</h2>
      <p>Text uses fonts already installed on your device (Avenir Next, Segoe UI or your system font, and Georgia). No font files are downloaded.</p>
    </Legal>
  );
}
