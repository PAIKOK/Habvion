import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useConsent } from "./CookieBanner";
import { Icon } from "./Icons";

/** Full-screen tools (editor, 3D viewers) have their own controls and never scroll. */
const FULL_SCREEN = /^\/(editor|shared|demos)(\/|$)/;

function useScroll() {
  const [state, setState] = useState({ progress: 0, y: 0, scrollable: false });
  const { pathname } = useLocation();
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = document.documentElement,
        max = el.scrollHeight - window.innerHeight,
        y = window.scrollY;
      setState({ progress: max > 0 ? Math.min(1, Math.max(0, y / max)) : 0, y, scrollable: max > 200 });
    };
    const onScroll = () => (frame ||= requestAnimationFrame(measure));
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    // Content that loads late (demo cards, credits) changes the page height.
    const ro = new ResizeObserver(onScroll);
    ro.observe(document.body);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      ro.disconnect();
    };
  }, [pathname]);
  return state;
}

/**
 * Site-wide helpers for long pages: a reading-progress bar under the top edge, a
 * back-to-top button once you have scrolled, and a floating "Ask us" button.
 * The floating buttons step aside while the cookie banner is asking its question.
 */
export function SiteChrome() {
  useEffect(() => {
    let saved: { node: HTMLDetailsElement; open: boolean; name: string | null }[] = [];
    const before = () => {
      if (saved.length) return;
      saved = [...document.querySelectorAll<HTMLDetailsElement>(".faq-item")].map((node) => ({ node, open: node.open, name: node.getAttribute("name") }));
      for (const { node } of saved) { node.removeAttribute("name"); node.open = true; }
    };
    const after = () => { for (const { node, open, name } of saved) { node.open = open; if (name !== null) node.setAttribute("name", name); } saved = []; };
    window.addEventListener("beforeprint", before); window.addEventListener("afterprint", after);
    return () => { window.removeEventListener("beforeprint", before); window.removeEventListener("afterprint", after); after(); };
  }, []);
  const { pathname } = useLocation(),
    { progress, y, scrollable } = useScroll(),
    banner = useConsent((s) => !s.decided || s.open);
  if (FULL_SCREEN.test(pathname)) return null;
  const showTop = scrollable && y > 600,
    showContact = pathname !== "/contact" && !banner;
  return (
    <>
      {scrollable && (
        <div
          className="scroll-progress"
          role="progressbar"
          aria-label="How far down the page you are"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <span style={{ transform: `scaleX(${progress})` }} />
        </div>
      )}
      {!banner && (
        <div className="floating-actions">
          <button
            type="button"
            className={`floating-button back-to-top${showTop ? " visible" : ""}`}
            aria-label="Back to top"
            title="Back to top"
            tabIndex={showTop ? 0 : -1}
            aria-hidden={!showTop}
            onClick={() => {
              const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
              window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
              document.getElementById("main")?.focus({ preventScroll: true });
            }}
          >
            <Icon name="arrow-up" size={18} />
          </button>
          {showContact && (
            <Link className="floating-button floating-contact" to="/contact" aria-label="Contact us" data-testid="floating-contact">
              <Icon name="chat" size={18} />
              <span>Ask us</span>
            </Link>
          )}
        </div>
      )}
    </>
  );
}
