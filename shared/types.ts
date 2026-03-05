export interface ProfileInput {
  platform: "hinge" | "tinder" | "bumble" | "other";
  bio: string;
  prompts: string[];
  photoDescriptions: string[];
  screenshots: string[];
  targetType: string;
  customTarget?: string;
}

export interface ProfileScore {
  overall: number;
  specificity: number;
  conversationHooks: number;
  authenticity: number;
  photoStrategy: number;
}

export interface ProfileFeedback {
  roast: string;
  mistakes: string[];
  profileType: "high-signal" | "generic" | "entertainment";
  profileTypeExplanation: string;
}

export interface OptimizedPrompt {
  original: string;
  improved: string;
  reason: string;
}

export interface PhotoAdvice {
  description: string;
  issue: string;
  suggestion: string;
  recommendedPosition: number;
}

export interface AnalysisResult {
  score: ProfileScore;
  feedback: ProfileFeedback;
  isPaid: false;
}

export interface FullOptimizationResult {
  score: ProfileScore;
  feedback: ProfileFeedback;
  optimizedBio: string;
  optimizedPrompts: OptimizedPrompt[];
  photoAdvice: PhotoAdvice[];
  toneAdjustments: string[];
  signalsToRemove: string[];
  targetAlignment: string;
  isPaid: true;
}

export type ProfileResult = AnalysisResult | FullOptimizationResult;

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
