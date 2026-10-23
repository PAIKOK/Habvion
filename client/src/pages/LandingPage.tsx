import { Link } from "react-router-dom";
import { SiteFooter } from "../ui/SiteFooter";
import { Faq } from "../ui/Faq";
import { Header } from "../ui/Header";
import { Icon } from "../ui/Icons";
import { DemoCards } from "../ui/DemoCards";
import { useAuthStore } from "../state/authStore";
import { APP_NAME } from "@shared/version";

// An editorial illustration, NOT a demo design or a separate editable model.
function PlotIllustration() {
  return (
    <svg
      className="plot-art"
      viewBox="0 0 520 430"
      role="img"
      aria-label="Architectural illustration of a courtyard home on a plot"
    >
      <defs>
        <pattern id="paper-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path
            d="M20 0H0v20"
            fill="none"
            stroke="currentColor"
            strokeOpacity=".075"
            strokeWidth=".7"
          />
        </pattern>
        <pattern id="floor-hatch" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M0 8 8 0" stroke="#b8aea0" strokeWidth=".5" />
        </pattern>
      </defs>
      <rect width="520" height="430" fill="url(#paper-grid)" />
      <g transform="translate(45,24)">
        <path d="M382 37V9m-5 8 5-8 5 8" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <text x="382" y="1" textAnchor="middle" fontSize="11" fill="currentColor">
          N
        </text>
        <rect
          x="36"
          y="38"
          width="324"
          height="320"
          fill="#e9efdf"
          stroke="#a8b795"
          strokeWidth="1.4"
        />
        <path d="M36 338h324" stroke="#cfb58e" strokeWidth="14" />
        <rect
          x="76"
          y="73"
          width="247"
          height="244"
          fill="#f9f5ed"
          stroke="#59564e"
          strokeWidth="6"
        />
        <path
          d="M76 166h151M174 73v93M227 73v244M76 249h151M150 166v151M227 191h96M227 251h96"
          fill="none"
          stroke="#59564e"
          strokeWidth="4"
        />
        <rect
          x="174"
          y="166"
          width="53"
          height="83"
          fill="#d8e4c6"
          stroke="#9daa8e"
          strokeWidth="1.5"
        />
        <g fill="#bac6a8">
          <circle cx="200" cy="203" r="13" />
          <circle cx="189" cy="214" r="12" />
          <circle cx="212" cy="220" r="11" />
        </g>
        <g fill="#cfc1ac" stroke="#a69b8b" strokeWidth="1">
          <rect x="91" y="97" width="42" height="53" rx="2" />
          <rect x="91" y="96" width="42" height="13" rx="3" fill="#fbfaf6" />
          <rect x="260" y="85" width="41" height="56" rx="2" />
          <rect x="260" y="84" width="41" height="13" rx="3" fill="#fbfaf6" />
        </g>
        <g fill="#e0bdac" stroke="#b8907c">
          <rect x="91" y="186" width="13" height="43" rx="4" />
          <rect x="92" y="184" width="41" height="13" rx="4" />
        </g>
        <rect x="113" y="207" width="21" height="18" rx="5" fill="#a68d73" />
        <g stroke="#a69b8b" fill="#d9c5ae">
          <rect x="88" y="267" width="49" height="29" rx="6" />
          <path d="M97 263v-9m20 9v-9M97 300v8m20-8v8" strokeWidth="6" />
        </g>
        <path d="M239 200h70v13h-57v27h-13Z" fill="#d1bfa9" stroke="#a29481" />
        <g fill="#f2efea" stroke="#a4a8a2">
          <ellipse cx="250" cy="278" rx="8" ry="11" />
          <rect x="286" y="266" width="25" height="30" rx="2" />
        </g>
        <g fill="#748c62" fillOpacity=".8">
          <circle cx="53" cy="63" r="13" />
          <circle cx="338" cy="290" r="11" />
          <circle cx="339" cy="314" r="8" />
          <circle cx="54" cy="313" r="10" />
          <circle cx="345" cy="63" r="9" />
        </g>
        <g fontSize="9" fill="#69635b" textAnchor="middle" fontFamily="system-ui">
          <text x="124" y="86">
            BEDROOM
          </text>
          <text x="274" y="156">
            MASTER
          </text>
          <text x="117" y="241">
            LIVING
          </text>
          <text x="111" y="313">
            DINING
          </text>
          <text x="277" y="245">
            KITCHEN
          </text>
        </g>
        <g stroke="#90a3ae" strokeWidth="5">
          <path d="M95 73h35m135 0h30M76 203v28M271 317h24" />
        </g>
        <path d="M150 280v25" stroke="#f9f5ed" strokeWidth="7" />
        <path d="M150 305h24a24 24 0 0 0-24-24" fill="none" stroke="#887261" strokeWidth="1" />
        <path d="M99 317h28" stroke="#f9f5ed" strokeWidth="7" />
        <path d="M98 359h43" stroke="#fbf9f5" strokeWidth="4" />
        <g stroke="#a49b8e" fill="none" strokeWidth=".8">
          <path d="M36 374v10m324-10v10M36 379h324M14 38h-9m9 320h-9M9 38v320" />
        </g>
        <g fill="#7e7569" fontSize="10" textAnchor="middle">
          <text x="198" y="394">
            YOUR PLOT. ENDLESS POSSIBILITIES.
          </text>
          <text transform="translate(-1 198) rotate(-90)">FROM BARE LAND TO A HOME</text>
        </g>
      </g>
    </svg>
  );
}
const features = [
  {
    icon: "plan",
    title: "Measured, not imagined",
    body: "Draw rooms on a real grid. Doors, stairs and furniture have dimensions, so you know what fits.",
  },
  {
    icon: "cube",
    title: "Step into your future home",
    body: "A floor plan and a 3D walkthrough, both created from the same design. Nothing to keep in sync.",
  },
  {
    icon: "spark",
    title: "An assistant that actually edits",
    body: "Ask for a bedroom or a larger kitchen. AI makes validated changes to your plan, not just suggestions.",
  },
  {
    icon: "rupee",
    title: "A budget that grows with you",
    body: "An itemised estimate in rupees — from the structural frame to your last piece of furniture.",
  },
];
export function LandingPage() {
  // Newcomers start with an account, the same as the header's "Start building".
  const start = useAuthStore((s) => s.user) ? "/start" : "/signup?next=%2Fstart";
  return (
    <>
      <Header />
      <main id="main" tabIndex={-1}>
        <section className="hero section-shell">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="tiny-dot" /> BUILT AROUND THE WAY INDIA LIVES
            </p>
            <h1>
              Design it.
              <br />
              See it.
              <br />
              <em>Make it yours.</em>
            </h1>
            <p className="hero-description">
              Start with an empty plot. Shape every room, see it in 3D, and plan what it will cost —
              with a little help from AI.
            </p>
            <div className="hero-actions">
              <Link to={start} className="button button-accent button-large">
                Design my home <Icon name="arrow" />
              </Link>
              <a href="#demo-homes" className="text-link">
                Explore demo homes <span>↗</span>
              </a>
            </div>
            <div className="hero-notes">
              <span>
                <Icon name="check" size={15} /> Feet or metres
              </span>
              <span>
                <Icon name="check" size={15} /> Indian defaults
              </span>
              <span>
                <Icon name="check" size={15} /> ₹ estimates
              </span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="drawing-label">
              <span className="tiny-dot" /> THE BEGINNING OF SOMETHING YOURS{" "}
              <span className="drawing-version">01 / CONCEPT</span>
            </div>
            <PlotIllustration />
            <div className="drawing-footer">
              <span>Made for real plots. And real life.</span>
              <Icon name="plan" size={20} />
            </div>
            <div className="floating-note">
              <span className="note-icon">
                <Icon name="spark" />
              </span>
              <div>
                <strong>Your ideas, brought to life.</strong>
                <small>One room at a time.</small>
              </div>
            </div>
          </div>
        </section>
        <section className="promise-strip">
          <div className="section-shell">
            <span>Thoughtful by design.</span>
            <p>
              A Vastu-planned demo home <b>·</b> Floor-by-floor layouts <b>·</b> Real furniture
              dimensions <b>·</b> Costs in lakh & crore
            </p>
          </div>
        </section>
        <section id="how-it-works" className="section-shell feature-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">A HOME, BEFORE IT’S A HOUSE</p>
              <h2>
                Make the big decisions.
                <br />
                Before the first brick.
              </h2>
            </div>
            <p>
              From the room you wake up in to the corner where you keep your mandir. Make space for
              the life you want to live.
            </p>
          </div>
          <div className="feature-grid">
            {features.map((f, i) => (
              <article className="feature-card" key={f.title}>
                <div className="feature-top">
                  <span className="feature-icon">
                    <Icon name={f.icon} size={24} />
                  </span>
                  <span className="feature-number">0{i + 1}</span>
                </div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="demo-homes" className="demo-section">
          <div className="section-shell">
            <p className="eyebrow">A LITTLE INSPIRATION</p>
            <h2>Explore Demo Homes</h2>
            <p className="section-subtitle">
              Start with a thoughtfully designed home, or create your own from an empty plot.
            </p>
            <DemoCards />
          </div>
        </section>
        <section id="faq" className="section-shell faq-section" aria-labelledby="faq-title">
          <div className="faq-intro">
            <p className="eyebrow">GOOD TO KNOW</p>
            <h2 id="faq-title">Frequently asked questions</h2>
            <p className="section-subtitle">
              Can’t find your answer? <Link to="/contact">Ask us</Link> and we’ll get back to you.
            </p>
          </div>
          <Faq heading="" />
        </section>
        <section className="section-shell final-section">
          <div>
            <p className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</p>
            <h2>
              All you need is a plot.
              <br />
              And a little imagination.
            </h2>
          </div>
          <Link to={start} className="button button-accent button-large">
            Let’s build your home <Icon name="arrow" />
          </Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
