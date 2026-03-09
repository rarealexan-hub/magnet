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
    window.history.pushState({}, "", "/");
  };

  const handleAuth = async (action: "login" | "register", email: string, password: string) => {
    if (action === "login") return login(email, password);
    return register(email, password);
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
            <button className="header-signin" onClick={() => setShowAuth(true)}>
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
          userEmail={user?.email}
          preselectedPlatform={preselectedPlatform}
        />
      )}
      {view === "results" && result && profileInput && (
        <Results
          result={result}
          profileInput={profileInput}
          onStartOver={handleStartOver}
          onFullReport={() => setView("full-report")}
          onDashboard={() => setView("dashboard")}
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

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onAuth={handleAuth} />}
    </div>
  );
}
