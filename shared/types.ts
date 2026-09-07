export const PLATFORMS = [
  { id: "hinge",              label: "Hinge",             color: "#e8472f" },
  { id: "tinder",             label: "Tinder",            color: "#fd5564" },
  { id: "bumble",             label: "Bumble",            color: "#f8b916" },
  { id: "raya",                label: "Raya",              color: "#151515" },
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
  relationshipIntent?: string;
  locationMarket?: string;
  preferredTone?: string;
  interests?: string[];
  partnerNonNegotiables?: string[];
  idealPartnerDescription?: string;
  datingHistory?: string;
  datingStruggle?: string;
  additionalContext?: string;
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
  rewriteA?: string;
  rewriteAAngle?: string;
  rewriteB?: string;
  rewriteBAngle?: string;
}

export interface PhotoOrderRecommendation {
  suggestedOrder: string[];
  reason: string;
}

export interface PhotoSignalAnalysis {
  photo: string;
  rank: number;
  signal: string;
  recommendation: string;
}

export interface ReshootBrief {
  title: string;
  shot: string;
  why: string;
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

export interface PotentialMatch {
  name: string;
  age: number;
  bio: string;
  whyTheySwipe: string;
}

export interface MatchPotential {
  currentWeeklyEstimate: string;
  optimizedWeeklyEstimate: string;
  percentageIncrease: string;
  topImprovements: string[];
}

export interface ProfileFeedback {
  roast: string;
  mistakes: string[];
  profileType: "high-signal" | "generic" | "entertainment";
  profileTypeExplanation: string;
  photoSwapRecommendations?: PhotoSwapRecommendation[];
  promptRecommendations?: PromptRecommendation[];
  photoOrderRecommendation?: PhotoOrderRecommendation;
  photoRanking?: PhotoSignalAnalysis[];
  accidentalSignals?: string;
  immediateFixes?: string[];
  reshootBriefs?: ReshootBrief[];
  platformRecommendations?: {
    hinge?: string;
    bumble?: string;
    tinder?: string;
  };
  categoryAnalysis?: CategoryAnalysis;
  sampleProfile?: SampleProfile;
  potentialMatches?: PotentialMatch[];
  matchPotential?: MatchPotential;
  leadPhotoTeaser?: string | null;
  betterLeadPhotoSuggestion?: string | null;
  personalitySignalsPromptRewrite?: { original: string; suggestion: string } | null;
}

export interface ProfileResult {
  score: ProfileScore;
  feedback: ProfileFeedback;
  analysisId?: number;
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

export type HumanAuditStatus =
  | "intake_started"
  | "intake_complete"
  | "awaiting_admin_review"
  | "followup_sent"
  | "followup_complete"
  | "final_report_ready";

export type HumanAuditQuestionStatus = "open" | "answered";

export interface HumanAuditAnswer {
  id: number;
  questionId: number;
  answer: string;
  answeredByEmail?: string | null;
  createdAt: string;
}

export interface HumanAuditQuestion {
  id: number;
  auditId: number;
  question: string;
  status: HumanAuditQuestionStatus;
  createdAt: string;
  answeredAt?: string | null;
  answers: HumanAuditAnswer[];
}

export interface HumanAudit {
  id: number;
  email: string;
  platform: string;
  status: HumanAuditStatus;
  intakeData: Record<string, unknown>;
  photoCalibration: {
    selectedIds: string[];
    rankedIds: string[];
  };
  clientBrief?: Record<string, unknown> | null;
  adminNotes?: string | null;
  questions: HumanAuditQuestion[];
  createdAt: string;
  updatedAt: string;
  finalReportReadyAt?: string | null;
}

export interface HumanAuditListItem {
  id: number;
  email: string;
  platform: string;
  status: HumanAuditStatus;
  questionCount: number;
  openQuestionCount: number;
  createdAt: string;
  updatedAt: string;
}

export const PLATFORM_PROMPTS: Record<string, string[]> = {
  hinge: [
    "A life goal of mine", "I'm looking for", "My simple pleasures",
    "The way to win me over is", "I get along best with people who",
    "Together, we could", "My most irrational fear",
    "Something I'd love to know about you", "I'm convinced that",
    "We're the same type of weird if", "The hallmark of a good relationship is",
    "My love language is", "I go crazy for", "All I ask is that you",
    "I want someone who", "Green flags I look for",
    "I recently discovered that", "Typical Sunday", "Two truths and a lie",
    "I'm weirdly attracted to", "My greatest strength", "Dating me is like",
    "The key to my heart is", "What I order for the table",
    "My most controversial opinion", "A shower thought I had recently",
    "The one thing I'd love to know about you", "Unusual skills",
    "This year I really want to", "I'm a great +1 because",
    "Let's debate this topic", "After work you'll find me",
    "Don't hate me if", "My therapist would say", "I take pride in",
    "The secret to getting to know me", "I feel most supported when",
    "Never have I never", "I was raised by", "Proof I have good taste",
    "One thing I'll never do again", "My hot take",
    "I promise I won't judge you if", "You should leave a comment if",
    "Give me movie recs for", "A pro and con of dating me",
    "The quickest way to my heart is", "I knew I found my person when",
    "Biggest risk I've taken", "My biggest date fail", "I geek out on",
    "My comfort food is", "Best travel story", "My go-to karaoke song",
    "A fun fact about me", "My ideal first date", "On my bucket list",
    "If I could have dinner with anyone", "One thing I'm grateful for",
    "My happy place", "Something I'm working on",
    "The best way to ask me out is", "My most useless skill",
    "My personal hell is", "I once got in trouble for",
  ],
  bumble: [
    "Right now I'm obsessed with", "Believe it or not, I",
    "My love language is", "I geek out on", "My simple pleasures",
    "A life goal of mine", "The way to win me over is", "I'm looking for",
    "Together, we could", "Unusual skills", "I go crazy for",
    "Best travel story", "My ideal first date", "A fun fact about me",
    "Something I'm working on", "What I order for the table",
    "I take pride in", "On my bucket list", "My happy place",
    "This year I really want to", "Two truths and a lie",
    "Never have I never", "My most controversial opinion",
    "Dating me is like", "After work you'll find me",
    "The key to my heart is", "I recently discovered that",
    "My comfort food is", "My go-to karaoke song", "One thing I'm grateful for",
  ],
  raya: [
    "Bio", "Job title", "Instagram handle", "Location",
    "My cities — lives in", "My cities — from",
    "Saved places — restaurants, bars, and clubs",
    "Interests", "Profile song",
  ],
  okcupid: [
    "My self-summary", "What I'm doing with my life", "I'm really good at",
    "The first thing people notice about me",
    "The six things I could never do without",
    "I spend a lot of time thinking about",
    "On a typical Friday night I am",
    "The most private thing I'm willing to admit",
    "What I'm actually looking for", "You should message me if",
  ],
  "coffee-meets-bagel": [
    "About me", "I'm looking for", "Something unique about me",
    "My ideal first date", "What I'm grateful for", "A fun fact about me",
    "My love language is", "The best way to win me over",
  ],
  "the-league": [
    "My current chapter", "Right now I'm focused on",
    "A conversation starter", "Outside of work I love",
    "My dream night out", "People would describe me as",
    "I'm passionate about", "Looking for someone who",
  ],
  her: [
    "About me", "I'm looking for", "My love language is",
    "A fun fact about me", "Right now I'm obsessed with",
    "What I'm grateful for", "My community means a lot because",
    "I want someone who",
  ],
  feeld: [
    "About me", "I'm here for", "My desires", "What I'm looking for",
    "Something unique about me", "My relationship style",
    "I'm most passionate about",
  ],
};

export const RELATIONSHIP_INTENTS = [
  { id: "long-term",        label: "Long-term relationship" },
  { id: "short-term",       label: "Short-term / casual" },
  { id: "open-to-both",     label: "Open to both" },
  { id: "marriage-minded",  label: "Marriage-minded" },
  { id: "figuring-it-out",  label: "Still figuring it out" },
] as const;

export const INTERESTS = [
  "Fitness / Gym", "Hiking / Outdoors", "Travel", "Cooking / Foodie",
  "Music / Concerts", "Reading", "Gaming", "Art / Design", "Photography",
  "Movies / TV", "Dancing", "Yoga / Meditation", "Sports", "Pets / Animals",
  "Wine / Cocktails", "Coffee Culture", "Board Games", "Volunteering",
  "Tech / Startups", "Fashion / Style",
] as const;

export const PARTNER_NON_NEGOTIABLES = [
  "Emotional maturity", "Good communicator", "Ambitious / Driven", "Sense of humor",
  "Physically active", "Family-oriented", "Financially stable", "Shares my values",
  "No smoking", "No heavy drinking", "Must love pets", "Wants kids",
  "Doesn't want kids", "Supportive of my career", "Politically aligned",
] as const;

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

export const TARGET_QUALITIES = [
  "Funny & Witty",
  "Intellectually Curious",
  "Emotionally Mature",
  "Confident",
  "Playful",
  "Spontaneous",
  "Laid-back",
  "Ambitious",
  "Kind-hearted",
  "Empathetic",
  "Adventurous",
  "Creative",
  "Sarcastic Humor",
  "Nerdy / Geeky",
  "Deep Thinker",
  "Fitness-Focused",
  "Outdoorsy",
  "Traveler",
  "Homebody",
  "Social Butterfly",
  "Foodie",
  "Dog Lover",
  "Cat Lover",
  "Career-Driven",
  "Entrepreneur",
  "Artistic / Creative",
  "Family-Oriented",
  "Spiritually-Minded",
  "Financially Stable",
  "Health-Conscious",
  "Stylish / Well-Dressed",
  "Cultured",
  "Night Owl",
  "Early Riser",
  "Book Lover",
  "Music Enthusiast",
  "Film Buff",
  "Gamer",
] as const;
