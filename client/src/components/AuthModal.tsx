import { useState, useEffect, useRef } from "react";
import { X, Loader2, Mail, Lock, BookMarked, ChevronDown, ChevronUp } from "lucide-react";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (element: HTMLElement, options: object) => void;
          prompt: () => void;
        };
      };
    };
  }
}

interface Props {
  onClose: () => void;
  onAuth: (action: "login" | "register", email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  onGoogleAuth?: (credential: string) => Promise<{ success: boolean; error?: string }>;
  context?: "default" | "save-results";
  googleClientId?: string;
}

export function AuthModal({ onClose, onAuth, onGoogleAuth, context = "default", googleClientId }: Props) {
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [mode, setMode] = useState<"login" | "register">(context === "save-results" ? "register" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const isSaveResults = context === "save-results";

  const heading = isSaveResults
    ? "Save your results"
    : "Sign in to Magnet";

  const subheading = isSaveResults
    ? "Sign in to save your Magnet score and access your dashboard."
    : "Sign in to access your Magnet account.";

  useEffect(() => {
    const clientId = googleClientId || (window as any).__GOOGLE_CLIENT_ID__;
    if (!clientId || !window.google?.accounts?.id || !googleBtnRef.current) return;

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response) => {
        if (!onGoogleAuth) return;
        setLoading(true);
        setError("");
        const result = await onGoogleAuth(response.credential);
        setLoading(false);
        if (result.success) {
          onClose();
        } else {
          setError(result.error || "Google sign-in failed");
        }
      },
    });

    window.google.accounts.id.renderButton(googleBtnRef.current, {
      theme: "outline",
      size: "large",
      width: googleBtnRef.current.offsetWidth || 336,
      text: isSaveResults ? "continue_with" : "signin_with",
      shape: "rectangular",
      logo_alignment: "left",
    });
  }, [googleBtnRef.current, googleClientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await onAuth(mode, email, password);
    if (!result.success) {
      setError(result.error || "Something went wrong");
    } else {
      onClose();
    }
    setLoading(false);
  };

  const toggleMode = () => {
    setMode(mode === "login" ? "register" : "login");
    setError("");
  };

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="auth-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <div className="auth-header">
          {isSaveResults && (
            <div className="auth-save-icon">
              <BookMarked size={22} />
            </div>
          )}
          <h2>{heading}</h2>
          <p>{subheading}</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <div className="auth-google-btn-wrap">
          <div ref={googleBtnRef} className="auth-google-btn-container" />
          {loading && (
            <div className="auth-google-loading">
              <Loader2 size={18} className="spin" />
            </div>
          )}
        </div>

        <div className="auth-divider">
          <button
            className="auth-email-toggle"
            onClick={() => setShowEmailForm(!showEmailForm)}
            type="button"
          >
            {showEmailForm ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showEmailForm ? "Hide email sign-in" : "Continue with email instead"}
          </button>
        </div>

        {showEmailForm && (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <div className="auth-input-wrap">
                <Mail size={16} className="auth-input-icon" />
                <input
                  type="email"
                  className="auth-input"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            <div className="auth-field">
              <div className="auth-input-wrap">
                <Lock size={16} className="auth-input-icon" />
                <input
                  type="password"
                  className="auth-input"
                  placeholder={mode === "register" ? "Password (6+ characters)" : "Password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
              </div>
            </div>

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? <Loader2 size={18} className="spin" /> : null}
              {mode === "login" ? "Sign In" : isSaveResults ? "Save & Continue" : "Create Account"}
            </button>

            <div className="auth-footer">
              <span>{mode === "login" ? "Don't have an account?" : "Already have an account?"}</span>
              <button type="button" className="auth-toggle" onClick={toggleMode}>
                {mode === "login" ? "Sign up" : "Sign in"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
