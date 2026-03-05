import { useState } from "react";
import { Landing } from "./components/Landing";
import { ProfileForm } from "./components/ProfileForm";
import { Results } from "./components/Results";
import type { ProfileInput, ProfileResult } from "@shared/types";

type View = "landing" | "form" | "results";

export default function App() {
  const [view, setView] = useState<View>("landing");
  const [result, setResult] = useState<ProfileResult | null>(null);
  const [profileInput, setProfileInput] = useState<ProfileInput | null>(null);

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
    </div>
  );
}
