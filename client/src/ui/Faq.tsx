import { useEffect, useId } from "react";
import { useLocation } from "react-router-dom";
import { FAQ } from "../content/faq";
import { Icon } from "./Icons";

/**
 * An accordion of questions. Each item is a native <details>, so it opens with Enter or
 * Space, is announced as expandable, and works without JavaScript. Sharing a `name`
 * makes the browser keep one answer open at a time. Linking to `#faq-<id>` (as site
 * search does) opens and scrolls to that answer.
 */
export function Faq({ heading = "Questions, answered.", items = FAQ }: { heading?: string; items?: typeof FAQ }) {
  const { hash } = useLocation(),
    group = useId();
  useEffect(() => {
    if (!hash.startsWith("#faq-")) return;
    const el = document.getElementById(hash.slice(1));
    if (!(el instanceof HTMLDetailsElement)) return;
    el.open = true;
    requestAnimationFrame(() => el.scrollIntoView({ block: "center" }));
  }, [hash]);
  return (
    <div className="faq">
      {heading && <h2 className="faq-heading">{heading}</h2>}
      <div className="faq-list">
        {items.map((item) => (
          <details key={item.id} id={`faq-${item.id}`} className="faq-item" name={group}>
            <summary>
              <span>{item.q}</span>
              <span className="faq-icon" aria-hidden="true">
                <Icon name="arrow" size={16} />
              </span>
            </summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
