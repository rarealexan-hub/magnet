import { useState, useEffect } from "react";
import { User } from "lucide-react";
import { Landing } from "./components/Landing";
import { ProfileForm } from "./components/ProfileForm";
import { Results } from "./components/Results";
import { FullReport } from "./components/FullReport";
import { Dashboard } from "./components/Dashboard";
import { AuthModal } from "./components/AuthModal";
import { UserMenu } from "./components/UserMenu";
import { useAuth } from "./hooks/useAuth";
import type { ProfileInput, ProfileResult, AnalysisRecord } from "@shared/types";

type View = "landing" | "form" | "results" | "full-report" | "dashboard" | "payment-verifying";

export default function App() {
  const [view, setView] = useState<View>("landing");
  const [result, setResult] = useState<ProfileResult | null>(null);
  const [profileInput, setProfileInput] = useState<ProfileInput | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [preselectedPlatform, setPreselectedPlatform] = useState<string | undefined>();
  const [fullReportViewed, setFullReportViewed] = useState(false);
  const [reportPurchased, setReportPurchased] = useState(false);
  const [authContext, setAuthContext] = useState<"default" | "save-results">("default");
  const [paymentVerifyError, setPaymentVerifyError] = useState<string | null>(null);
  const { user, loading, token, login, loginWithGoogle, register, logout } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    const sessionId = params.get('session_id');

    if (paymentStatus === 'success' && sessionId) {
      window.history.replaceState({}, '', '/');
      setView('payment-verifying');

      const pending = sessionStorage.getItem('magnet_pending_purchase');
      let restoredResult: ProfileResult | null = null;
      let restoredInput: ProfileInput | null = null;

      if (pending) {
        try {
          const parsed = JSON.parse(pending);
          restoredResult = parsed.result;
          restoredInput = parsed.profileInput;
        } catch {}
      }

      const token = localStorage.getItem('magnet_token');
      const userEmail = restoredResult?.analysisId ? undefined : undefined;

      fetch('/api/checkout/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ sessionId, userEmail: '' }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.success) {
            sessionStorage.removeItem('magnet_pending_purchase');
            if (restoredResult && restoredInput) {
              setResult(restoredResult);
              setProfileInput(restoredInput);
              setFullReportViewed(true);
              setReportPurchased(true);
              setView('full-report');
            } else {
              setView('landing');
            }
          } else {
            setPaymentVerifyError('Payment could not be verified. Please contact support.');
            setView('landing');
          }
        })
        .catch(() => {
          setPaymentVerifyError('Payment verification failed. Please contact support.');
          setView('landing');
        });
    } else if (paymentStatus === 'cancelled') {
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const handleStartAudit = () => setView("form");

  const handleResult = (data: ProfileResult, input: ProfileInput) => {
    setResult(data);
    setProfileInput(input);
    setView("results");
  };

  const handleStartOver = () => {
    setView("landing");
    setResult(null);
    setProfileInput(null);
    setPreselectedPlatform(undefined);
    setFullReportViewed(false);
    window.history.pushState({}, "", "/");
  };

  const handleAuth = async (action: "login" | "register", email: string, password: string) => {
    const res = action === "login" ? await login(email, password) : await register(email, password);
    return res;
  };

  const handleGoogleAuth = async (credential: string) => {
    const res = await loginWithGoogle(credential);
    return res;
  };

  const openAuthForResults = () => {
    setAuthContext("save-results");
    setShowAuth(true);
  };

  const openAuthDefault = () => {
    setAuthContext("default");
    setShowAuth(true);
  };

  const handleAnalyzeFromDashboard = (platform?: string) => {
    setResult(null);
    setProfileInput(null);
    setPreselectedPlatform(platform);
    setView("form");
  };

  const handleViewResultFromDashboard = (analysis: AnalysisRecord) => {
    setResult({
      score: analysis.score,
      feedback: analysis.feedback,
      analysisId: analysis.id,
    });
    setProfileInput({
      platform: analysis.platform as ProfileInput["platform"],
      email: analysis.email,
      bio: "",
      prompts: [],
      photoDescriptions: [],
      screenshots: [],
      currentPhotos: [],
      additionalPhotos: [],
      targetType: "",
    });
    setView("results");
  };

  const handleViewFullReportFromDashboard = (analysis: AnalysisRecord) => {
    setResult({
      score: analysis.score,
      feedback: analysis.feedback,
      analysisId: analysis.id,
    });
    setProfileInput({
      platform: analysis.platform as ProfileInput["platform"],
      email: analysis.email,
      bio: "",
      prompts: [],
      photoDescriptions: [],
      screenshots: [],
      currentPhotos: [],
      additionalPhotos: [],
      targetType: "",
    });
    setFullReportViewed(true);
    setReportPurchased(!!analysis.purchased);
    setView("full-report");
  };

  return (
    <div className="app">
      {paymentVerifyError && (
        <div className="payment-error-banner">
          {paymentVerifyError}
          <button onClick={() => setPaymentVerifyError(null)}>✕</button>
        </div>
      )}

      {view === "payment-verifying" && (
        <div className="payment-verifying-screen">
          <div className="payment-verifying-card">
            <div className="payment-verifying-spinner" />
            <h2>Unlocking your Full Report…</h2>
            <p>Verifying your payment, just a moment.</p>
          </div>
        </div>
      )}

      {view !== "payment-verifying" && (
        <>
          {!loading && (
            <div className="app-header">
              {user ? (
                <UserMenu
                  user={user}
                  onLogout={() => { logout(); handleStartOver(); }}
                  onDashboard={() => setView("dashboard")}
                />
              ) : (
                <button
                  className="header-signin"
                  onClick={view === "results" ? openAuthForResults : openAuthDefault}
                >
                  <User size={14} />
                  Sign In
                </button>
              )}
            </div>
          )}

          {view === "landing" && <Landing onStart={handleStartAudit} />}
          {view === "form" && (
            <ProfileForm
              onResult={handleResult}
              onBack={() => setView("landing")}
              userEmail={user?.email}
              preselectedPlatform={preselectedPlatform}
            />
          )}
          {view === "results" && result && profileInput && (
            <Results
              result={result}
              profileInput={profileInput}
              onStartOver={handleStartOver}
              onFullReport={() => { setFullReportViewed(true); setView("full-report"); }}
              onBundle={() => { setFullReportViewed(true); setView("full-report"); }}
              fullReportViewed={fullReportViewed}
              user={user}
              onSignIn={openAuthForResults}
            />
          )}
          {view === "full-report" && result && profileInput && (
            <FullReport
              result={result}
              profileInput={profileInput}
              onBack={() => setView("results")}
              purchased={reportPurchased}
            />
          )}
          {view === "dashboard" && (
            <Dashboard
              onAnalyze={handleAnalyzeFromDashboard}
              onViewResult={handleViewResultFromDashboard}
              onViewFullReport={handleViewFullReportFromDashboard}
              onBack={() => result ? setView("results") : setView("landing")}
              userEmail={user?.email}
              token={token}
            />
          )}

          {showAuth && (
            <AuthModal
              onClose={() => setShowAuth(false)}
              onAuth={handleAuth}
              onGoogleAuth={handleGoogleAuth}
              googleClientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}
              context={authContext}
            />
          )}
        </>
      )}
    </div>
  );
}
