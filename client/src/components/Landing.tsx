import { useState } from "react";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  ClipboardList,
  Magnet as MagnetIcon,
  MessageSquareText,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";

interface Props {
  onStart: () => void;
  onPrivacy: () => void;
}

type ReadKey = "photos" | "prompts" | "signal";

const readPanels: Record<
  ReadKey,
  {
    tab: string;
    eyebrow: string;
    headline: string;
    body: string;
    current: string[];
    fixes: string[];
  }
> = {
  photos: {
    tab: "Photos",
    eyebrow: "Lead photo read",
    headline: "Good photo. Weak first impression.",
    body: "The issue is not how you look. It is what the first few seconds make someone assume.",
    current: ["Face is too small at swipe speed", "Best expression is buried later", "Two photos repeat the same signal"],
    fixes: ["Move the outdoor candid first", "Crop tighter from chest up", "Replace one duplicate solo shot"],
  },
  prompts: {
    tab: "Prompts",
    eyebrow: "Bio and prompt read",
    headline: "Specific beats polished.",
    body: "A profile works when it gives someone an easy reason to start a real conversation.",
    current: ["Generic travel and food language", "No opinion, taste, or scene", "Answers do not invite a reply"],
    fixes: ["Add one sharp personal detail", "Rewrite the opener as a hook", "Give matches something easy to ask about"],
  },
  signal: {
    tab: "Signal",
    eyebrow: "Whole profile read",
    headline: "The vibe is clear in pieces, not as a whole.",
    body: "Magnet checks whether your photos, prompts, and goal are pulling in the same direction.",
    current: ["Profile reads more casual than intended", "Attraction cues are uneven", "Target match is not obvious"],
    fixes: ["Clarify the dating intention", "Balance warmth with confidence", "Remove signals that attract the wrong fit"],
  },
};

const auditPieces = [
  { icon: Camera, label: "Photo order", text: "Which image should lead, which should move, and which one is costing attention." },
  { icon: MessageSquareText, label: "Prompt rewrites", text: "Sharper answers that sound like you and give people a place to start." },
  { icon: Target, label: "Target fit", text: "Whether your profile is attracting the kind of person you actually want." },
  { icon: ClipboardList, label: "Action plan", text: "A short list of changes ranked by what to fix first." },
];

const reportRows = [
  "First impression and accidental signals",
  "Photo-by-photo notes with order changes",
  "Bio and prompt edits in your preferred tone",
  "Clear fixes for the next version of your profile",
];

export function Landing({ onStart, onPrivacy }: Props) {
  const [activeRead, setActiveRead] = useState<ReadKey>("photos");
  const panel = readPanels[activeRead];

  return (
    <main className="landing landing-redesign">
      <section className="landing-hero-redesign">
        <img
          className="landing-hero-image"
          src="/magnet-profile-audit-hero.png"
          alt="Profile photos and phone arranged for a profile audit"
        />
        <div className="landing-hero-wash" aria-hidden="true" />
        <div className="landing-hero-content">
          <div className="landing-brand-lockup">
            <MagnetIcon size={23} strokeWidth={2.1} />
            <span>Magnet</span>
          </div>
          <p className="landing-kicker-redesign">Dating profile audit</p>
          <h1>Make your profile easier to choose.</h1>
          <p className="landing-subtitle-redesign">
            Upload screenshots. Magnet reads the photos, prompts, order, and subtext, then gives you the edits that make your profile feel clearer, more specific, and more like you.
          </p>
          <div className="landing-hero-actions">
            <button className="landing-primary-button" onClick={onStart}>
              Start the audit
              <ArrowRight size={18} />
            </button>
            <span>Private review. One complete audit with clear next steps.</span>
          </div>
        </div>
      </section>

      <section className="landing-signal-strip" aria-label="Audit coverage">
        <span className="landing-strip-label">Reviews the parts friends skip</span>
        <span>Lead photo</span>
        <span>Photo order</span>
        <span>Bio and prompts</span>
        <span>First impression</span>
        <span>Match fit</span>
      </section>

      <section className="landing-audit-preview">
        <div className="landing-section-copy">
          <p className="landing-kicker-redesign">Inside the read</p>
          <h2>The feedback is direct, not decorative.</h2>
          <p>
            Magnet looks at what your profile communicates before someone knows you: confidence, specificity, warmth, effort, and who the profile seems built for.
          </p>
        </div>

        <div className="landing-preview-panel">
          <div className="landing-preview-tabs" role="tablist" aria-label="Sample audit sections">
            {(Object.keys(readPanels) as ReadKey[]).map((key) => (
              <button
                key={key}
                className={activeRead === key ? "active" : ""}
                onClick={() => setActiveRead(key)}
                role="tab"
                aria-selected={activeRead === key}
              >
                {readPanels[key].tab}
              </button>
            ))}
          </div>

          <div className="landing-preview-body" key={activeRead}>
            <div className="landing-preview-heading">
              <span>{panel.eyebrow}</span>
              <h3>{panel.headline}</h3>
              <p>{panel.body}</p>
            </div>

            <div className="landing-preview-columns">
              <div>
                <div className="landing-column-label problem">
                  <Zap size={14} />
                  Current read
                </div>
                <ul>
                  {panel.current.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="landing-column-label fix">
                  <CheckCircle2 size={14} />
                  Fix direction
                </div>
                <ul>
                  {panel.fixes.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-audit-pieces">
        {auditPieces.map(({ icon: Icon, label, text }) => (
          <article key={label} className="landing-piece">
            <Icon size={20} />
            <h3>{label}</h3>
            <p>{text}</p>
          </article>
        ))}
      </section>

      <section className="landing-report-section">
        <div className="landing-report-copy">
          <p className="landing-kicker-redesign">What you get</p>
          <h2>A practical edit plan, not a confidence pep talk.</h2>
          <p>
            The report is built to answer one question: what should change before your profile goes back live?
          </p>
        </div>
        <div className="landing-report-list">
          {reportRows.map((row, index) => (
            <div className="landing-report-row" key={row}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{row}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-final-cta">
        <div>
          <Sparkles size={22} />
          <h2>Ready for the honest read?</h2>
          <p>Start with your current profile. Leave with the edits that make the next version easier to say yes to.</p>
        </div>
        <button className="landing-primary-button light" onClick={onStart}>
          Start the audit
          <ArrowRight size={18} />
        </button>
      </section>

      <footer className="landing-footer landing-footer-redesign">
        <span className="landing-footer-copy">© {new Date().getFullYear()} Magnet</span>
        <span className="landing-footer-dot">·</span>
        <button className="landing-footer-link" onClick={onPrivacy}>Privacy Policy</button>
        <span className="landing-footer-dot">·</span>
        <a className="landing-footer-link" href="mailto:hello@trymagnetapp.com">Contact</a>
      </footer>
    </main>
  );
}