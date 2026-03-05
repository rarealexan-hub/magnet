import { useState, useEffect } from "react";
import { Landing } from "./components/Landing";
import { ProfileForm } from "./components/ProfileForm";
import { Results } from "./components/Results";
import { Success } from "./components/Success";
import type { ProfileInput, ProfileResult } from "@shared/types";

type View = "landing" | "form" | "results" | "success";

export default function App() {
  const [view, setView] = useState<View>("landing");
  const [result, setResult] = useState<ProfileResult | null>(null);
  const [profileInput, setProfileInput] = useState<ProfileInput | null>(null);

  useEffect(() => {
    if (window.location.pathname === "/success") {
      setView("success");
    }
  }, []);

  const handleStartAudit = () => setView("form");

  const handleResult = (data: ProfileResult, input: ProfileInput) => {
    setResult(data);
    setProfileInput(input);
    setView("results");
  };

  const handleBack = () => {
    setView("form");
    setResult(null);
  };

  const handleStartOver = () => {
    setView("landing");
    setResult(null);
    setProfileInput(null);
    window.history.pushState({}, "", "/");
  };

  return (
    <div className="app">
      {view === "landing" && <Landing onStart={handleStartAudit} />}
      {view === "form" && <ProfileForm onResult={handleResult} />}
      {view === "results" && result && profileInput && (
        <Results
          result={result}
          profileInput={profileInput}
          onBack={handleBack}
          onStartOver={handleStartOver}
          onUpgrade={(upgraded) => setResult(upgraded)}
        />
      )}
      {view === "success" && <Success onStartOver={handleStartOver} />}
    </div>
  );
}
