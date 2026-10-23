import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../state/authStore";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icons";
import { SiteSearch } from "./SiteSearch";
import { APP_NAME } from "@shared/version";

export function Header({ children }: { children?: React.ReactNode }) {
  const { user, status, logout } = useAuthStore(),
    nav = useNavigate(),
    location = useLocation(),
    [dark, setDark] = useState(() => document.documentElement.dataset.theme === "dark"),
    [menuOpen, setMenuOpen] = useState(false),
    [searchOpen, setSearchOpen] = useState(false),
    menuButton = useRef<HTMLButtonElement>(null),
    menu = useRef<HTMLDivElement>(null),
    // The editor passes its own controls; the site-wide menu and search belong to the public pages.
    site = !children;

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try {
      localStorage.setItem("hb-theme", next ? "dark" : "light");
    } catch {}
  }

  // The menu closes when the page changes.
  useEffect(() => setMenuOpen(false), [location.pathname, location.hash]);

  // Open: focus the first link; Escape or a click outside closes it and returns focus.
  useEffect(() => {
    if (!menuOpen) return;
    menu.current?.querySelector<HTMLElement>("a,button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !menuButton.current?.contains(t)) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [menuOpen]);

  // Ctrl/⌘ K anywhere, or "/" when not typing, opens search.
  useEffect(() => {
    if (!site) return;
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") || (e.key === "/" && !typing)) {
        e.preventDefault();
        setMenuOpen(false);
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [site]);

  async function signOut() {
    await logout();
    nav("/");
  }

  return (
    <header className="site-header">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="header-inner">
        <Link className="brand" to="/" aria-label={`${APP_NAME} home`}>
          <span className="brand-mark">
            <Icon name="home" size={22} />
          </span>
          <span>{APP_NAME}</span>
        </Link>
        <nav className="header-nav" aria-label="Main navigation">
          {children ?? (
            <>
              <a className="desktop-link" href="/#how-it-works">
                How it works
              </a>
              <a className="desktop-link" href="/#demo-homes">
                Demo homes
              </a>
              <Link className="desktop-link" to="/contact">
                Contact
              </Link>
            </>
          )}
          {site && (
            <button className="icon-button" onClick={() => setSearchOpen(true)} aria-label="Search the site" title="Search (Ctrl K)" aria-haspopup="dialog">
              <Icon name="search" />
            </button>
          )}
          <button className="icon-button" onClick={toggle} aria-label={`Switch to ${dark ? "light" : "dark"} mode`}>
            <Icon name={dark ? "sun" : "moon"} />
          </button>
          {status === "ready" &&
            (user ? (
              <div className="account" data-testid="account">
                {site && (
                  <Link className="desktop-link" to="/designs">
                    My designs
                  </Link>
                )}
                <Link className="account-name" to="/account" title={`${user.email} — your account and data`}>
                  {user.name}
                </Link>
                <button className={`small-button${site ? " desktop-only" : ""}`} onClick={signOut}>
                  Sign out
                </button>
              </div>
            ) : (
              <>
                <Link className="desktop-link" to="/login">
                  Log in
                </Link>
                {children && (
                  <Link className="small-button" to="/signup">
                    Sign up
                  </Link>
                )}
              </>
            ))}
          {site && (
            <Link className="button button-dark header-cta" to={user ? "/start" : "/signup?next=%2Fstart"}>
              Start building <Icon name="arrow" size={16} />
            </Link>
          )}
          {site && (
            <button
              ref={menuButton}
              className="icon-button menu-button"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <Icon name={menuOpen ? "close" : "menu"} />
            </button>
          )}
        </nav>
      </div>
      {site && (
        <div ref={menu} id="mobile-menu" className="mobile-menu" hidden={!menuOpen}>
          <nav aria-label="Menu">
            <a href="/#how-it-works">How it works</a>
            <a href="/#demo-homes">Demo homes</a>
            <a href="/#faq">Questions</a>
            <Link to="/contact">Contact us</Link>
            {user ? (
              <>
                <Link to="/designs">My designs</Link>
                <Link to="/account">Your account and data</Link>
                <button type="button" onClick={signOut}>
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/login">Log in</Link>
                <Link to="/signup">Create an account</Link>
              </>
            )}
          </nav>
        </div>
      )}
      {site && <SiteSearch open={searchOpen} onClose={() => setSearchOpen(false)} />}
    </header>
  );
}
