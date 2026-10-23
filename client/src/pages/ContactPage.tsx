import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CONTACT_TOPICS, contactSchema, type ContactTopic } from "@shared/contact/schema";
import { Header } from "../ui/Header";
import { SiteFooter } from "../ui/SiteFooter";
import { Icon } from "../ui/Icons";
import { api } from "../api/client";
import { useAuthStore } from "../state/authStore";
import { APP_NAME } from "@shared/version";
import { BUSINESS } from "@shared/legal/business";
import { campaignTags } from "../lib/utm";
import { fieldErrors, focusFirstError } from "../lib/fieldErrors";
import { CopyButton } from "../ui/CopyButton";
import { Faq } from "../ui/Faq";
import { FAQ } from "../content/faq";

type Form = { name: string; email: string; topic: ContactTopic; message: string; website: string };
const EMPTY: Form = { name: "", email: "", topic: "general", message: "", website: "" };
const CONTACT_FAQ = FAQ.filter((f) => ["cost", "estimates", "data", "share"].includes(f.id));

/** A question for the team: public, validated with the same rules as the server. */
export function ContactPage() {
  const user = useAuthStore((s) => s.user),
    forwardingEnabled = useAuthStore((s) => s.contactForwardingEnabled),
    [form, setForm] = useState<Form>(EMPTY),
    [error, setError] = useState(""),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [tried, setTried] = useState(false),
    formRef = useRef<HTMLFormElement>(null),
    utm = useRef(campaignTags()).current,
    [busy, setBusy] = useState(false),
    [sent, setSent] = useState<string | null>(null);
  // Signed in: the name and email are already known, but stay editable.
  useEffect(() => {
    if (user) setForm((f) => ({ ...f, name: f.name || user.name, email: f.email || user.email }));
  }, [user]);
  useEffect(() => {
    const before = document.title;
    document.title = `Contact us · ${APP_NAME}`;
    return () => void (document.title = before);
  }, []);
  // After the first attempt, errors update as the person types, so they see each one clear.
  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    const next = { ...form, [key]: value };
    setForm(next);
    if (tried) {
      const p = contactSchema.safeParse(next);
      setErrors(p.success ? {} : fieldErrors(p.error));
      if (p.success) setError("");
    }
  };
  const invalid = (key: string) => (errors[key] ? { "aria-invalid": true as const, "aria-describedby": `contact-${key}-error` } : {});
  const errorFor = (key: string) =>
    errors[key] && (
      <span className="field-error" id={`contact-${key}-error`}>
        {errors[key]}
      </span>
    );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    const parsed = contactSchema.safeParse(form);
    if (!parsed.success) {
      const found = fieldErrors(parsed.error);
      setErrors(found);
      setError(`Check the ${Object.keys(found).length === 1 ? "highlighted field" : `${Object.keys(found).length} highlighted fields`} and try again.`);
      return focusFirstError(formRef.current);
    }
    setBusy(true);
    setError("");
    setErrors({});
    try {
      setSent((await api<{ reference: string }>("/contact", { body: { ...form, ...(Object.keys(utm).length ? { utm } : {}) } })).reference);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Your message could not be sent. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Header />
      <main id="main" tabIndex={-1} className="contact-page section-shell">
        <section className="contact-intro">
          <p className="eyebrow">CONTACT US</p>
          <h1>
            Questions? <em>Ask away.</em>
          </h1>
          <p className="contact-lead">Whether it's about your plot, a demo home, or a number in your estimate, write to us and we'll get back to you.</p>
          <ul className="contact-tips">
            <li>
              <Icon name="plan" size={18} />
              <span>
                <strong>About a design?</strong> Mention its name and your plot size so we can find it quickly.
              </span>
            </li>
            <li>
              <span className="contact-rupee">₹</span>
              <span>
                <strong>About costs?</strong> Estimates are indicative mid-range figures before GST — tell us your city for context.
              </span>
            </li>
            <li>
              <Icon name="spark" size={18} />
              <span>
                <strong>Something broken?</strong> Say what you clicked and what you expected to happen.
              </span>
            </li>
          </ul>
          {(BUSINESS.email || BUSINESS.phone) && (
            <p className="contact-direct">
              Or reach us directly: {BUSINESS.email && <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>}
              {BUSINESS.email && BUSINESS.phone && " · "}
              {BUSINESS.phone && <a href={`tel:${BUSINESS.phone.replace(/[^\d+]/g, "")}`}>{BUSINESS.phone}</a>}
            </p>
          )}
          <p className="small-note">
            Not ready to ask yet? <Link to="/#demo-homes">Browse the demo homes</Link> for ideas.
          </p>
          <div className="contact-faq">
            <Faq heading="Quick answers" items={CONTACT_FAQ} />
          </div>
        </section>

        <section className="contact-card" aria-live="polite">
          {sent ? (
            <div className="contact-done" data-testid="contact-done">
              <span className="contact-check" aria-hidden>
                ✓
              </span>
              <h2>Thank you — your message is in.</h2>
              <p>
                We'll reply to <strong>{form.email.trim().toLowerCase()}</strong>. Quote your reference if you write again.
              </p>
              <div className="contact-reference-row">
                <span>Reference</span>
                <strong data-testid="contact-reference">{sent}</strong>
                <CopyButton text={sent} label="Copy reference" />
              </div>
              <div className="contact-done-actions">
                <button
                  className="button button-outline"
                  onClick={() => {
                    setSent(null);
                    setForm((f) => ({ ...EMPTY, name: f.name, email: f.email }));
                    setTried(false);
                  }}
                >
                  Send another
                </button>
                <Link className="button button-accent" to="/">
                  Back to home
                </Link>
              </div>
            </div>
          ) : (
            <form ref={formRef} onSubmit={submit} noValidate aria-label="Contact form">
              <div className="fields-row">
                <label className="field">
                  <span>
                    Name <small>optional</small>
                  </span>
                  <input name="name" autoComplete="name" value={form.name} maxLength={80} onChange={(e) => set("name", e.target.value)} {...invalid("name")} />
                  {errorFor("name")}
                </label>
                <label className="field">
                  <span>Email</span>
                  <input name="email" type="email" autoComplete="email" value={form.email} maxLength={254} onChange={(e) => set("email", e.target.value)} required aria-required="true" {...invalid("email")} />
                  {errorFor("email")}
                </label>
              </div>
              <div className="fields-row">
                <label className="field">
                  <span>Your question is about</span>
                  <select name="topic" value={form.topic} onChange={(e) => set("topic", e.target.value as ContactTopic)} {...invalid("topic")}>
                    {CONTACT_TOPICS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  {errorFor("topic")}
                </label>
              </div>
              <label className="field">
                <span>
                  Message <small>{form.message.trim().length} / 4,000</small>
                </span>
                <textarea name="message" rows={7} value={form.message} maxLength={4000} placeholder="Tell us what you'd like to know…" onChange={(e) => set("message", e.target.value)} required aria-required="true" {...invalid("message")} />
                {errorFor("message")}
              </label>
              {/* Campaign tags from the link the visitor arrived by, kept in memory only and sent with the message. */}
              {Object.entries(utm).map(([key, value]) => (
                <input key={key} type="hidden" name={`utm_${key}`} value={value} />
              ))}
              {/* Hidden from people and screen readers; bots fill it in. */}
              <label className="contact-trap" aria-hidden>
                Website
                <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set("website", e.target.value)} />
              </label>
              {error && (
                <p className="error-text contact-error" role="alert">
                  {error}
                </p>
              )}
              <button className="button button-accent contact-submit" disabled={busy}>
                {busy ? "Sending…" : "Send message"} {!busy && <Icon name="arrow" size={16} />}
              </button>
              <p className="small-note contact-privacy">Your email and message are used to respond, as described in our <Link to="/privacy">Privacy Policy</Link>. New enquiries have a 90-day retention setting and routine cleanup; external Google/email copies need separate retention controls. Please do not include passwords, card numbers, government IDs or exact home addresses.</p>
            </form>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
