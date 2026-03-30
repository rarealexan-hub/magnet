import { useState } from "react";
import { X, Loader2, Mail, Lock, BookMarked } from "lucide-react";

interface Props {
  onClose: () => void;
  onAuth: (action: "login" | "register", email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  context?: "default" | "save-results";
}

export function AuthModal({ onClose, onAuth, context = "default" }: Props) {
  const [mode, setMode] = useState<"login" | "register">(context === "save-results" ? "register" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isSaveResults = context === "save-results";

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

  const heading = isSaveResults
    ? mode === "register"
      ? "Save your results"
      : "Welcome back"
    : mode === "login"
      ? "Welcome back"
      : "Create your account";

  const subheading = isSaveResults
    ? mode === "register"
      ? "Create an account to save your Magnet score, access your Dashboard, and share feedback."
      : "Sign in to access your saved results and share feedback."
    : mode === "login"
      ? "Sign in to your Magnet account"
      : "Get started with Magnet";

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="auth-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <div className="auth-header">
          {isSaveResults && mode === "register" && (
            <div className="auth-save-icon">
              <BookMarked size={22} />
            </div>
          )}
          <h2>{heading}</h2>
          <p>{subheading}</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}

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
        </form>

        <div className="auth-footer">
          <span>{mode === "login" ? "Don't have an account?" : "Already have an account?"}</span>
          <button type="button" className="auth-toggle" onClick={toggleMode}>
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
