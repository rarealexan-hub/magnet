import { useState } from "react";
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

type View = "landing" | "form" | "results" | "full-report" | "dashboard";

export default function App() {
  const [view, setView] = useState<View>("landing");
  const [result, setResult] = useState<ProfileResult | null>(null);
  const [profileInput, setProfileInput] = useState<ProfileInput | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [preselectedPlatform, setPreselectedPlatform] = useState<string | undefined>();
  const [fullReportViewed, setFullReportViewed] = useState(false);
  const [triggerFeedback, setTriggerFeedback] = useState(false);
  const [authContext, setAuthContext] = useState<"default" | "save-results">("default");
  const { user, loading, token, login, register, logout } = useAuth();

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
    setTriggerFeedback(false);
    window.history.pushState({}, "", "/");
  };

  const handleAuth = async (action: "login" | "register", email: string, password: string) => {
    const res = action === "login" ? await login(email, password) : await register(email, password);
    if (res.success && view === "results") {
      setTriggerFeedback(true);
      setTimeout(() => setTriggerFeedback(false), 200);
    }
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

  return (
    <div className="app">
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
          triggerFeedback={triggerFeedback}
        />
      )}
      {view === "full-report" && result && profileInput && (
        <FullReport
          result={result}
          profileInput={profileInput}
          onBack={() => setView("results")}
        />
      )}
      {view === "dashboard" && (
        <Dashboard
          onAnalyze={handleAnalyzeFromDashboard}
          onViewResult={handleViewResultFromDashboard}
          onBack={() => result ? setView("results") : setView("landing")}
          userEmail={user?.email}
          token={token}
        />
      )}

      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onAuth={handleAuth}
          context={authContext}
        />
      )}
    </div>
  );
}
