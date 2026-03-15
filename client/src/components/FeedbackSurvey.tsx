import { useState, useEffect } from "react";
import { Star, X, Send, Check, ChevronDown } from "lucide-react";

interface Props {
  page: string;
  platform?: string;
  magnetScore?: number;
  email?: string;
  defaultOpen?: boolean;
  surveyRef?: React.RefObject<HTMLDivElement>;
}

const IMPROVEMENT_OPTIONS = [
  "More detailed feedback",
  "Better photo analysis",
  "Clearer action steps",
  "Faster analysis",
  "More platform options",
  "Something else",
];

type Step = "banner" | "form" | "done" | "dismissed";

export function FeedbackSurvey({ page, platform, magnetScore, email, defaultOpen, surveyRef }: Props) {
  const [step, setStep] = useState<Step>(defaultOpen ? "form" : "banner");

  useEffect(() => {
    if (defaultOpen && step !== "done" && step !== "dismissed") {
      setStep("form");
    }
  }, [defaultOpen]);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [wouldRecommend, setWouldRecommend] = useState<string>("");
  const [biggestImprovement, setBiggestImprovement] = useState("");
  const [openFeedback, setOpenFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!rating) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          wouldRecommend,
          biggestImprovement,
          openFeedback,
          page,
          platform: platform ?? "",
          magnetScore: magnetScore ?? "",
          email: email ?? "",
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setStep("done");
    } catch {
      setError("Couldn't submit — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (step === "dismissed") return null;

  return (
    <div className="feedback-survey" ref={surveyRef}>
      {step === "banner" && (
        <div className="feedback-banner">
          <span className="feedback-banner-text">
            Got 30 seconds? Help us improve Magnet.
          </span>
          <div className="feedback-banner-actions">
            <button className="feedback-open-btn" onClick={() => setStep("form")}>
              Give Feedback
            </button>
            <button className="feedback-dismiss-btn" onClick={() => setStep("dismissed")}>
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {step === "form" && (
        <div className="feedback-form-wrap">
          <div className="feedback-form">
            <div className="feedback-form-header">
              <h4>Quick Feedback</h4>
              <button className="feedback-dismiss-btn" onClick={() => setStep("dismissed")}>
                <X size={16} />
              </button>
            </div>

            <div className="feedback-field">
              <label>How useful was your Magnet analysis?</label>
              <div className="star-row">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    className={`star-btn ${s <= (hovered || rating) ? "active" : ""}`}
                    onMouseEnter={() => setHovered(s)}
                    onMouseLeave={() => setHovered(0)}
                    onClick={() => setRating(s)}
                  >
                    <Star size={36} />
                  </button>
                ))}
              </div>
            </div>

            <div className="feedback-field">
              <label>Would you recommend Magnet to a friend?</label>
              <div className="feedback-options">
                {["Definitely", "Probably", "Not sure", "No"].map((opt) => (
                  <button
                    key={opt}
                    className={`feedback-option ${wouldRecommend === opt ? "selected" : ""}`}
                    onClick={() => setWouldRecommend(opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="feedback-field">
              <label>What would make Magnet better?</label>
              <div className="feedback-select-wrap">
                <select
                  className="feedback-select"
                  value={biggestImprovement}
                  onChange={(e) => setBiggestImprovement(e.target.value)}
                >
                  <option value="">Select an option...</option>
                  {IMPROVEMENT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="feedback-select-icon" />
              </div>
            </div>

            <div className="feedback-field">
              <label>Anything else? (optional)</label>
              <textarea
                className="feedback-textarea"
                placeholder="Tell us what you think..."
                value={openFeedback}
                onChange={(e) => setOpenFeedback(e.target.value)}
                rows={3}
              />
            </div>

            {error && <p className="feedback-error">{error}</p>}

            <div className="feedback-form-footer">
              <button
                className="feedback-submit-btn"
                onClick={submit}
                disabled={!rating || submitting}
              >
                {submitting ? "Sending..." : <><Send size={15} /> Send Feedback</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="feedback-done">
          <Check size={20} />
          <span>Thanks for your feedback!</span>
          <button className="feedback-dismiss-btn" onClick={() => setStep("dismissed")}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
