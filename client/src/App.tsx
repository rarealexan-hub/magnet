import { useState, useEffect } from "react";
import { User } from "lucide-react";
import { Landing } from "./components/Landing";
import { ProfileForm } from "./components/ProfileForm";
import { Results } from "./components/Results";
import { FullReport } from "./components/FullReport";
import { Dashboard } from "./components/Dashboard";
import { AuthModal } from "./components/AuthModal";
import { UserMenu } from "./components/UserMenu";
import { HumanAuditAdmin } from "./components/HumanAudit";
import { PrivacyPolicy } from "./components/PrivacyPolicy";
import { useAuth } from "./hooks/useAuth";
import type { ProfileInput, ProfileResult, AnalysisRecord } from "@shared/types";
import { trackPageView, trackSignIn, trackSignUp, trackFullReportOpened, trackAnalyzeAnother } from "./lib/analytics";

type View = "landing" | "form" | "results" | "full-report" | "dashboard" | "privacy" | "admin";

export default function App() {
  const [view, setView] = useState<View>("landing");
  const [result, setResult] = useState<ProfileResult | null>(null);
  const [profileInput, setProfileInput] = useState<ProfileInput | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [preselectedPlatform, setPreselectedPlatform] = useState<string | undefined>();
  const [fullReportViewed, setFullReportViewed] = useState(false);
  const [authContext, setAuthContext] = useState<"default" | "save-results">("default");
  const [repeatAuditEmail, setRepeatAuditEmail] = useState("");
  const { user, loading, token, login, loginWithGoogle, register, logout } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const preview = params.get('preview');

    if (preview === 'full-report') {
      window.history.replaceState({}, '', '/');
      const mockResult: ProfileResult = {
        score: { overall: 61, photoQuality: 54, attractionSignals: 58, personalitySignals: 72, matchTargeting: 49, firstImpression: 63 },
        feedback: {
          roast: "You've got charm buried under a pile of blurry photos, a group shot where nobody can tell which one you are, and a gym selfie that says 'I own a mirror' more than 'I have a life.' Your prompts are doing real work but your photos are actively working against you.",
          mistakes: [
            "Lead photo is a group shot — matches can't tell who you are in the first 2 seconds",
            "Two photos taken in the same bathroom, same lighting, same angle — variety is nonexistent",
            "Bio mentions 'love to laugh' — the single most overused phrase on dating apps",
            "No photos showing hobbies, travel, or social life — profile reads as 'I own a couch'",
          ],
          profileType: "generic",
          profileTypeExplanation: "Your profile hits the most common traps: safe photos, safe prompts, no real differentiation. You're not doing anything wrong, but you're not doing anything memorable either — which in a pool of thousands of profiles is basically the same thing.",
          categoryAnalysis: {
            photoQuality: "Your photos are technically acceptable but strategically weak. Two are clearly shot on an older phone in low light, and one is so heavily filtered it looks like a different person. The gym photo is sharp but it's doing zero work — showing you can lift weights is table stakes, not a personality.",
            attractionSignals: "There's a decent smile in photo 3, but it's buried at position 4 in your lineup. Your lead photo shows you squinting into the sun in sunglasses — two things that tank first impressions. Eye contact and a genuine, relaxed expression are the highest-converting elements in a lead photo, and neither is present.",
            personalitySignals: "Your prompts are genuinely your strongest asset. 'My most controversial opinion' answer shows wit and specificity. The bio has a personality somewhere in there, but it's surrounded by filler phrases that dilute the signal. Cut the generic opener and get to the good stuff faster.",
            matchTargeting: "Your profile doesn't clearly signal what kind of person you're looking for or what kind of relationship you want. Ambitious, emotionally mature matches need to see ambition and emotional maturity in your content — right now it's neutral, which attracts everyone and no one.",
            firstImpression: "The first 2 seconds of your profile (lead photo + name) aren't landing the way they should. A sunglasses photo with no clear expression gives matches nothing to react to. The first photo should make someone feel something — curiosity, attraction, a laugh — not uncertainty about which person you are.",
          },
          promptRecommendations: [
            {
              promptIndex: 1,
              currentPrompt: "I love to laugh and have fun, looking for someone to go on adventures with",
              issue: "This is the most generic bio opener on every dating app. 'I love to laugh' appears in roughly 40% of all profiles — it signals nothing about who you are and everything about playing it safe.",
              suggestion: "Cut this entirely and open with something specific. What's an adventure you actually went on recently? Lead with that. The goal is to make someone think 'oh, this person is interesting' in the first sentence.",
              rewriteA: "Got lost in Lisbon for 4 hours last spring. Best day of the year. Looking for someone who can navigate worse than me.",
              rewriteB: "I plan the trip, you pick the restaurant. Neither of us checks reviews. This is how we'll end up somewhere great.",
            },
            {
              promptIndex: 2,
              currentPrompt: "My most controversial opinion: pineapple on pizza is actually fine",
              issue: "Not actually a problem — this is working. The pineapple opinion is overused but your specific framing of it has personality. Consider keeping it but following it with a stranger, more specific take.",
              suggestion: "Add a second line that's more niche. The pineapple thing is the warm-up — what's the take that's actually yours?",
              rewriteA: "Pineapple on pizza is fine. The real villain is putting chicken in pasta. I will die on this hill and I will die well-fed.",
              rewriteB: "Hot take: pineapple on pizza is fine, brunch is overrated, and Die Hard is a Christmas movie. I've done the math.",
            },
          ],
          photoSwapRecommendations: [
            { action: "swap", currentPhoto: "Photo #1", additionalPhoto: "Extra Photo A", reason: "Your current lead photo is a group shot taken at what appears to be a wedding — matches can't identify you immediately. Extra Photo A (the solo outdoor shot with good natural lighting) should be your lead. Clear face, genuine smile, interesting background." },
            { action: "remove", currentPhoto: "Photo #3", reason: "Second bathroom mirror selfie — redundant and low-effort. You already have one mirror photo; two reads as someone who doesn't have a social life to photograph. Remove and replace with something that shows you doing something." },
            { action: "add", additionalPhoto: "Extra Photo B", reason: "The concert photo shows you in a real social context, genuinely engaged. This is exactly the kind of shot that generates comments and gives matches a conversation starter." },
          ],
          photoOrderRecommendation: {
            suggestedOrder: ["Extra Photo A (new lead)", "Photo #2", "Extra Photo B (add)", "Photo #4", "Photo #5"],
            reason: "New order puts your strongest photo first, groups the social/active shots in the middle where matches are most engaged, and ends on a natural smile. The gym photo moves to the end or gets cut — it reads better as an afterthought than a statement.",
          },
          sampleProfile: {
            headline: "Here's what your profile could look like:",
            bio: "Software engineer by day, extremely mediocre chef by night. I make a carbonara that would make an Italian grandmother cry — but for the wrong reasons. Currently training for a half marathon mostly so I can justify eating the carbonara.",
            prompts: [
              { question: "My most controversial opinion", answer: "Pineapple on pizza is fine, but the real villain is putting chicken in pasta. I will die on this hill and I will die well-fed." },
              { question: "The way to win me over is", answer: "Show up with a strong recommendation — book, restaurant, weird documentary, anything. I'm immediately more interested in people who are enthusiastic about specific things." },
            ],
            summary: "Same core person — but the opener is specific, the prompts have a point of view, and a match can immediately picture what hanging out with you would feel like.",
          },
          potentialMatches: [
            { name: "Priya, 28", age: 28, bio: "UX designer, amateur bread baker, strong opinions about font choices and where to get the best ramen in the city.", whyTheySwipe: "The carbonara line made her laugh. The half marathon detail shows you're goal-oriented without being insufferable about fitness." },
            { name: "Sarah, 31", age: 31, bio: "Attorney. Hikes on weekends. Reading 3 books simultaneously at any given time. Looking for someone who has interesting opinions about things.", whyTheySwipe: "The 'strong recommendation' prompt signals you're someone who thinks about things and has taste — that's exactly her filter." },
          ],
          matchPotential: {
            currentWeeklyEstimate: "3–5 matches/week",
            optimizedWeeklyEstimate: "12–18 matches/week",
            percentageIncrease: "~240%",
            topImprovements: ["Replace lead photo with solo outdoor shot", "Remove duplicate bathroom selfie", "Rewrite opener bio line with a specific story", "Add concert/social photo from extras"],
          },
        },
      };
      const mockInput: ProfileInput = {
        platform: "hinge",
        email: "",
        bio: "I love to laugh and have fun, looking for someone to go on adventures with",
        prompts: ["My most controversial opinion: pineapple on pizza is actually fine", "The way to win me over is showing up with a strong recommendation"],
        photoDescriptions: [],
        screenshots: [],
        currentPhotos: [],
        additionalPhotos: [],
        targetType: "ambitious-professionals",
        gender: "man",
        sexualOrientation: "straight",
        partnerPreferences: ["women"],
      };
      setResult(mockResult);
      setProfileInput(mockInput);
      setFullReportViewed(true);
      setView("full-report");
      return;
    }

    if (preview === 'results') {
      window.history.replaceState({}, '', '/');
      const mockResult: ProfileResult = {
        score: { overall: 61, photoQuality: 54, attractionSignals: 58, personalitySignals: 72, matchTargeting: 49, firstImpression: 63 },
        feedback: {
          roast: "You've got charm buried under a pile of blurry photos, a group shot where nobody can tell which one you are, and a gym selfie that says 'I own a mirror' more than 'I have a life.' Your prompts are doing real work but your photos are actively working against you.",
          mistakes: [
            "Lead photo is a group shot — matches can't tell who you are in the first 2 seconds",
            "Two photos taken in the same bathroom, same lighting, same angle — variety is nonexistent",
            "Bio mentions 'love to laugh' — the single most overused phrase on dating apps",
            "No photos showing hobbies, travel, or social life — profile reads as 'I own a couch'",
          ],
          profileType: "generic",
          profileTypeExplanation: "Your profile hits the most common traps: safe photos, safe prompts, no real differentiation. You're not doing anything wrong, but you're not doing anything memorable either.",
          categoryAnalysis: {
            photoQuality: "Your photos are technically acceptable but strategically weak.",
            attractionSignals: "There's a decent smile in photo 3, but it's buried at position 4 in your lineup.",
            personalitySignals: "Your prompts are genuinely your strongest asset.",
            matchTargeting: "Your profile doesn't clearly signal what kind of person you're looking for.",
            firstImpression: "The first 2 seconds of your profile aren't landing the way they should.",
          },
          promptRecommendations: [],
          photoSwapRecommendations: [],
        },
      };
      const mockInput: ProfileInput = {
        platform: "hinge",
        email: "",
        bio: "I love to laugh and have fun, looking for someone to go on adventures with",
        prompts: ["My most controversial opinion: pineapple on pizza is actually fine"],
        photoDescriptions: [],
        screenshots: [],
        currentPhotos: [],
        additionalPhotos: [],
        targetType: "ambitious-professionals",
        gender: "man",
        sexualOrientation: "straight",
        partnerPreferences: ["women"],
      };
      setResult(mockResult);
      setProfileInput(mockInput);
      setFullReportViewed(false);
      setView("results");
      return;
    }

  }, []);

  useEffect(() => {
    const viewNames: Record<string, string> = {
      landing: "Landing",
      form: "Analysis Form",
      results: "Results",
      "full-report": "Full Report",
      dashboard: "Dashboard",
      privacy: "Privacy Policy",
      admin: "Audit Admin",
    };
    trackPageView(viewNames[view] ?? view);
  }, [view]);

  // When auth resolves and user is already logged in, send them straight to their dashboard.
  // Also fires when view changes to "landing" (e.g. Back on form, Start Over) so logged-in
  // users are never left stranded on the landing page.
  useEffect(() => {
    if (!loading && user && view === "landing") {
      setView("dashboard");
    }
  }, [user, loading, view]);

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
    if (res.success) {
      if (action === "login") trackSignIn("email");
      else trackSignUp("email");
      if (authContext === "default") {
        setShowAuth(false);
        setView("dashboard");
      }
    }
    return res;
  };

  const handleGoogleAuth = async (credential: string) => {
    const res = await loginWithGoogle(credential);
    if (res.success) {
      trackSignIn("google");
      if (authContext === "default") {
        setShowAuth(false);
        setView("dashboard");
      }
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

  const handleOpenAdmin = () => setView("admin");

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
    setView("full-report");
  };

  return (
    <div className={`app app-view-${view}`}>
          {!loading && (
            <div className="app-header">
              {user ? (
                <UserMenu
                  user={user}
                  onLogout={() => { logout(); handleStartOver(); }}
                  onDashboard={() => setView("dashboard")}
                   onAdmin={handleOpenAdmin}
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

          {view === "landing" && <Landing onStart={handleStartAudit} onPrivacy={() => setView("privacy")} />}
          {view === "privacy" && <PrivacyPolicy onBack={() => setView("landing")} />}
          {view === "form" && (
            <ProfileForm
              onResult={handleResult}
              onBack={() => setView("landing")}
              userEmail={user?.email || repeatAuditEmail}
              preselectedPlatform={preselectedPlatform}
            />
          )}
          {view === "results" && result && profileInput && (
            <Results
              result={result}
              profileInput={profileInput}
              onStartOver={handleStartOver}
              onFullReport={() => { trackFullReportOpened(profileInput.platform); setFullReportViewed(true); setView("full-report"); }}
              onBundle={() => { trackFullReportOpened(profileInput.platform); setFullReportViewed(true); setView("full-report"); }}
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
              onAnalyzeAnother={() => {
                trackAnalyzeAnother();
                setRepeatAuditEmail(profileInput.email);
                setFullReportViewed(false);
                setResult(null);
                setProfileInput(null);
                setView("form");
                if (!user) openAuthForResults();
              }}
              isAuthenticated={!!user}
              onSignIn={user ? undefined : openAuthForResults}
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
           {view === "admin" && (
             <HumanAuditAdmin
               token={token}
               onBack={() => setView(user ? "dashboard" : "landing")}
             />
           )}

          {showAuth && (
            <AuthModal
              onClose={() => setShowAuth(false)}
              onAuth={handleAuth}
              onGoogleAuth={handleGoogleAuth}
              googleClientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}
              context={authContext}
              onPrivacy={() => { setShowAuth(false); setView("privacy"); }}
            />
          )}
    </div>
  );
}
