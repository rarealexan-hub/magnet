export interface ProfileInput {
  platform: "hinge" | "tinder" | "bumble" | "other";
  email: string;
  bio: string;
  prompts: string[];
  photoDescriptions: string[];
  screenshots: string[];
  currentPhotos: string[];
  additionalPhotos: string[];
  targetType: string;
  customTarget?: string;
  sexualOrientation?: string;
  partnerPreferences?: string[];
}

export const SEXUAL_ORIENTATIONS = [
  { id: "straight", label: "Straight" },
  { id: "gay", label: "Gay / Lesbian" },
  { id: "bisexual", label: "Bisexual" },
  { id: "pansexual", label: "Pansexual" },
  { id: "queer", label: "Queer" },
  { id: "prefer-not-to-say", label: "Prefer not to say" },
] as const;

export const PARTNER_PREFERENCES = [
  { id: "men", label: "Men" },
  { id: "women", label: "Women" },
  { id: "non-binary", label: "Non-binary people" },
  { id: "trans-men", label: "Trans men" },
  { id: "trans-women", label: "Trans women" },
  { id: "genderfluid", label: "Genderfluid people" },
  { id: "any-gender", label: "Any gender" },
] as const;

export interface ProfileScore {
  overall: number;
  photoQuality: number;
  attractionSignals: number;
  personalitySignals: number;
  matchTargeting: number;
  firstImpression: number;
}

export interface PhotoSwapRecommendation {
  action: "swap" | "add" | "remove" | "reorder";
  currentPhoto?: string;
  additionalPhoto?: string;
  reason: string;
}

export interface PromptRecommendation {
  promptIndex: number;
  currentPrompt: string;
  issue: string;
  suggestion: string;
}

export interface PhotoOrderRecommendation {
  suggestedOrder: string[];
  reason: string;
}

export interface CategoryAnalysis {
  photoQuality: string;
  attractionSignals: string;
  personalitySignals: string;
  matchTargeting: string;
  firstImpression: string;
}

export interface ProfileFeedback {
  roast: string;
  mistakes: string[];
  profileType: "high-signal" | "generic" | "entertainment";
  profileTypeExplanation: string;
  photoSwapRecommendations?: PhotoSwapRecommendation[];
  promptRecommendations?: PromptRecommendation[];
  photoOrderRecommendation?: PhotoOrderRecommendation;
  categoryAnalysis?: CategoryAnalysis;
}

export interface ProfileResult {
  score: ProfileScore;
  feedback: ProfileFeedback;
}

export interface AnalysisRecord {
  id: number;
  email: string;
  platform: string;
  score: ProfileScore;
  feedback: ProfileFeedback;
  created_at: string;
}

export interface DashboardData {
  analyses: AnalysisRecord[];
  platforms: {
    platform: string;
    latestScore: number;
    analysisCount: number;
    lastAnalyzed: string;
  }[];
}

export const TARGET_TYPES = [
  { id: "ambitious-professionals", label: "Ambitious Professionals", description: "Career-driven, motivated, goal-oriented" },
  { id: "creatives", label: "Creatives & Artists", description: "Artistic, expressive, unconventional" },
  { id: "outdoorsy", label: "Outdoorsy & Active", description: "Adventure lovers, fitness enthusiasts, nature fans" },
  { id: "intellectual", label: "Intellectual & Curious", description: "Deep thinkers, readers, always learning" },
  { id: "playful-adventurous", label: "Playful & Adventurous", description: "Spontaneous, fun-loving, down for anything" },
  { id: "emotionally-mature", label: "Emotionally Mature", description: "Self-aware, communicative, relationship-ready" },
  { id: "funny-witty", label: "Funny & Witty", description: "Sharp humor, clever banter, doesn't take life too seriously" },
  { id: "custom", label: "Custom", description: "Describe your ideal match" },
] as const;
