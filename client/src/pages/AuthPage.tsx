import { useCallback, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { loginSchema, signupSchema } from "@shared/auth/schemas";
import { Header } from "../ui/Header";
import { SiteFooter } from "../ui/SiteFooter";
import { GoogleButton } from "../ui/GoogleButton";
import { safeNext, useAuthStore } from "../state/authStore";
import { PasswordInput } from "../ui/PasswordInput";
import { fieldErrors, focusFirstError } from "../lib/fieldErrors";

export function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const auth = useAuthStore(),
    nav = useNavigate(),
    [params] = useSearchParams(),
    next = safeNext(params.get("next")),
    [form, setForm] = useState({ name: "", email: "", password: "" }),
    [agree, setAgree] = useState(false),
    [error, setError] = useState(""),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [tried, setTried] = useState(false),
    formRef = useRef<HTMLFormElement>(null),
    [busy, setBusy] = useState(false),
    signup = mode === "signup";
  const done = useCallback(() => nav(next, { replace: true }), [nav, next]);
  const validate = (values: typeof form, agreed: boolean) => (signup ? signupSchema.safeParse({ ...values, consent: agreed }) : loginSchema.safeParse(values));
  // After the first attempt, errors update as the person types.
  function recheck(values: typeof form, agreed: boolean) {
    if (!tried) return;
    const p = validate(values, agreed);
    setErrors(p.success ? {} : fieldErrors(p.error));
    if (p.success) setError("");
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    const parsed = validate(form, agree);
    if (!parsed.success) {
      const found = fieldErrors(parsed.error),
        n = Object.keys(found).length;
      setErrors(found);
      setError(n === 1 ? "Check the highlighted field and try again." : `Check the ${n} highlighted fields and try again.`);
      return focusFirstError(formRef.current);
    }
    setBusy(true);
    setError("");
    setErrors({});
    try {
      if (signup) await auth.signup(parsed.data as { name: string; email: string; password: string; consent: true });
      else await auth.login(parsed.data);
      done();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }
  const field = (key: keyof typeof form, label: string, type: string, autoComplete: string) => {
    const props = {
      name: key,
      autoComplete,
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const next = { ...form, [key]: e.target.value };
        setForm(next);
        recheck(next, agree);
      },
      required: key !== "name",
      "aria-required": key !== "name",
      maxLength: key === "password" ? 200 : key === "email" ? 254 : 80,
      minLength: key === "password" && signup ? 10 : undefined,
      "aria-invalid": errors[key] ? (true as const) : undefined,
      "aria-describedby": errors[key] ? `auth-${key}-error` : undefined,
    };
    return (
      <label className="field">
        <span>{label}</span>
        {type === "password" ? <PasswordInput {...props} /> : <input type={type} {...props} />}
        {errors[key] && (
          <span className="field-error" id={`auth-${key}-error`}>
            {errors[key]}
          </span>
        )}
      </label>
    );
  };
  return (
    <>
      <Header />
      <main id="main" tabIndex={-1} className="auth-page">
        <form ref={formRef} className="auth-card" onSubmit={submit} noValidate>
          <p className="eyebrow">{signup ? "CREATE YOUR ACCOUNT" : "WELCOME BACK"}</p>
          <h1>{signup ? "Start your home." : "Log in."}</h1>
          <p className="auth-sub">{signup ? "Your designs are saved to your account." : "Pick up where you left off."}</p>
          {signup && (
            <label className="check-field consent-field">
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => {
                  setAgree(e.target.checked);
                  recheck(form, e.target.checked);
                }}
                data-testid="signup-consent"
                aria-invalid={errors.consent ? true : undefined}
                aria-describedby={errors.consent ? "auth-consent-error" : undefined}
              />
              <span>
                I am 18 or older, accept the <Link to="/terms">Terms and Conditions</Link>, and consent to using my account details and saved designs for the requested account features, as explained in the <Link to="/privacy">Privacy Policy</Link>. This is not marketing consent.
              </span>
            </label>
          )}
          {errors.consent && (
            <p className="field-error" id="auth-consent-error">
              {errors.consent}
            </p>
          )}
          <GoogleButton onSignedIn={done} onError={setError} locked={signup && !agree ? "— tick the box above first" : undefined} consent={signup && agree} />
          <div className="auth-or">
            <span>or with email</span>
          </div>
          {signup && field("name", "Name (optional — a nickname is fine)", "text", "nickname")}
          {field("email", "Email", "email", "email")}
          {field("password", signup ? "Password (10+ characters)" : "Password", "password", signup ? "new-password" : "current-password")}
          {error && (
            <p className="error-text auth-error" role="alert">
              {error}
            </p>
          )}
          <button className="button button-accent auth-submit" disabled={busy}>
            {busy ? "Please wait…" : signup ? "Create account" : "Log in"}
          </button>
          <p className="auth-switch">
            {signup ? "Already have an account? " : "New here? "}
            <Link to={`/${signup ? "login" : "signup"}${params.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`}>
              {signup ? "Log in" : "Create an account"}
            </Link>
          </p>
        </form>
      </main>
      <SiteFooter />
    </>
  );
}
