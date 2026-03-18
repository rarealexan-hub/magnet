export const PLATFORMS = [
  { id: "hinge",              label: "Hinge",             color: "#e8472f" },
  { id: "tinder",             label: "Tinder",            color: "#fd5564" },
  { id: "bumble",             label: "Bumble",            color: "#f8b916" },
  { id: "okcupid",            label: "OkCupid",           color: "#4a90d9" },
  { id: "coffee-meets-bagel", label: "Coffee Meets Bagel",color: "#c8563a" },
  { id: "match",              label: "Match",             color: "#e8212f" },
  { id: "happn",              label: "Happn",             color: "#dd335c" },
  { id: "the-league",         label: "The League",        color: "#b9935a" },
  { id: "feeld",              label: "Feeld",             color: "#b97fb7" },
  { id: "hily",               label: "Hily",              color: "#ff6b35" },
  { id: "plenty-of-fish",     label: "Plenty of Fish",    color: "#00a4c4" },
  { id: "zoosk",              label: "Zoosk",             color: "#e04c14" },
  { id: "grindr",             label: "Grindr",            color: "#f5a623" },
  { id: "badoo",              label: "Badoo",             color: "#7436e3" },
  { id: "blk",                label: "BLK",               color: "#888888" },
  { id: "her",                label: "HER",               color: "#d63384" },
  { id: "other",              label: "Other",             color: "#6366f1" },
] as const;

export type PlatformId = typeof PLATFORMS[number]["id"];

export const PLATFORM_LABEL: Record<string, string> = Object.fromEntries(PLATFORMS.map(p => [p.id, p.label]));
export const PLATFORM_COLOR: Record<string, string> = Object.fromEntries(PLATFORMS.map(p => [p.id, p.color]));

export interface ProfileInput {
  platform: PlatformId;
  email: string;
  bio: string;
  prompts: string[];
  photoDescriptions: string[];
  screenshots: string[];
  currentPhotos: string[];
  additionalPhotos: string[];
  targetType: string;
  customTarget?: string;
  gender?: string;
  sexualOrientation?: string;
  partnerPreferences?: string[];
  photoTasteSelections?: string[];
}

export const GENDER_OPTIONS = [
  { id: "man", label: "Man" },
  { id: "woman", label: "Woman" },
  { id: "non-binary", label: "Non-binary" },
  { id: "genderfluid", label: "Genderfluid" },
  { id: "transgender-man", label: "Transgender man" },
  { id: "transgender-woman", label: "Transgender woman" },
  { id: "other", label: "Other" },
  { id: "prefer-not-to-say", label: "Prefer not to say" },
] as const;

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

export interface SamplePrompt {
  question: string;
  answer: string;
}

export interface SampleProfile {
  headline: string;
  bio?: string;
  prompts?: SamplePrompt[];
  summary: string;
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
  sampleProfile?: SampleProfile;
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
