import { Link } from "react-router-dom";
import { BUSINESS, POLICY_UPDATED, POLICY_VERSION, businessReadinessIssues } from "@shared/legal/business";
import { openCookieSettings } from "./CookieBanner";

/** Business details and every policy, on every public page. Unset details are not shown. */
const updated = new Date(`${__BUILD_DATE__}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

export function SiteFooter() {
  const details = [BUSINESS.legalName, BUSINESS.address, BUSINESS.registration].filter(Boolean);
  return (
    <footer className="site-footer section-shell">
      <span>{BUSINESS.brand}</span>
      <div className="footer-brand">
        <p>Designs and costs are estimates, not construction documents. Made for homes in India.</p>
        {details.length > 0 && <p className="footer-business">{details.join(" · ")}</p>}
        {businessReadinessIssues().length > 0 && <p className="business-pending" role="note">Operator identity and grievance contact are not yet published. This prototype is not ready for a public launch or live personal-data collection.</p>}
        <p className="footer-meta">
          Site last updated <time dateTime={__BUILD_DATE__}>{updated}</time> · Policies updated <time dateTime={POLICY_VERSION}>{POLICY_UPDATED}</time>
        </p>
        {(BUSINESS.email || BUSINESS.phone) && (
          <p className="footer-business">
            {BUSINESS.email && <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>}
            {BUSINESS.email && BUSINESS.phone && " · "}
            {BUSINESS.phone && <a href={`tel:${BUSINESS.phone.replace(/[^\d+]/g, "")}`}>{BUSINESS.phone}</a>}
          </p>
        )}
      </div>
      <nav className="footer-links" aria-label="Legal and help">
        <Link to="/contact">Contact us</Link>
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
        <Link to="/cookies">Cookies</Link>
        <Link to="/refunds">Refunds</Link>
        <Link to="/credits">Credits</Link>
        <button type="button" className="link-button" onClick={openCookieSettings}>
          Cookie settings
        </button>
      </nav>
    </footer>
  );
}
