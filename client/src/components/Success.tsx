import { useEffect, useState } from "react";
import { CheckCircle, ArrowRight, Loader2, AlertCircle } from "lucide-react";

interface Props {
  onStartOver: () => void;
}

export function Success({ onStartOver }: Props) {
  const [status, setStatus] = useState<"loading" | "paid" | "error">("loading");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");

    if (!sessionId) {
      setStatus("error");
      return;
    }

    fetch(`/api/checkout/session/${sessionId}`)
      .then((r) => r.json())
      .then((data) => {
        setStatus(data.status === "paid" ? "paid" : "error");
      })
      .catch(() => setStatus("error"));
  }, []);

  if (status === "loading") {
    return (
      <div className="success-page">
        <div className="success-container">
          <Loader2 size={48} className="spin" style={{ color: "var(--accent)" }} />
          <p style={{ marginTop: 16 }}>Confirming your payment...</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="success-page">
        <div className="success-container">
          <AlertCircle size={64} style={{ color: "var(--accent)", marginBottom: 24 }} />
          <h2>Something went wrong</h2>
          <p>We couldn't confirm your payment. If you were charged, please contact support.</p>
          <button className="cta-button" onClick={onStartOver}>
            Back to Home
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
    );
  }

  const sessionId = new URLSearchParams(window.location.search).get("session_id");

  return (
    <div className="success-page">
      <div className="success-container">
        <CheckCircle size={64} className="success-icon" />
        <h2>Payment Successful</h2>
        <p>
          Your Magnet guidance is ready. Upload your profile again and we'll generate your
          full analysis with bio advice, prompt suggestions, and photo strategy.
        </p>
        <button className="cta-button" onClick={() => {
          if (sessionId) {
            sessionStorage.setItem("paidSessionId", sessionId);
          }
          onStartOver();
        }}>
          Get My Full Guidance
          <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
}
