import OpenAI from "openai";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import type { ProfileInput, AnalysisResult, FullOptimizationResult } from "../shared/types.js";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const SYSTEM_PROMPT = `You are the world's best dating profile consultant — witty, slightly teasing, but genuinely helpful. You know the psychology of dating apps inside and out.

Key principles you follow:
1. HIGH-SIGNAL profiles perform best: specific interests, clear personality, good prompts that reveal thinking
2. GENERIC profiles underperform: "love traveling and good food" tells no one anything
3. The best profiles combine HIGH-SIGNAL + LIGHT HUMOR: personality + approachability + conversation hooks
4. People swipe when they think "I want to know more about this person" — curiosity > perfection
5. Profiles that feel human and specific beat profiles that try to look perfect

The 7 most common mistakes:
1. The "Generic Human" bio — everyone likes travel and food
2. Group photos where you can't tell who's who
3. Conflicting signals between photos
4. Prompts that don't create conversation
5. Low-energy first photo
6. Trying too hard to look perfect instead of authentic
7. No clear personality signal

Your feedback style:
- Instead of "Your bio lacks specificity" say "This bio could belong to 4.7 million people on this app"
- Be witty and slightly roasting but never mean
- Always constructive — every critique comes with a better alternative
- Sound like a clever friend giving real talk, not a corporate consultant

Three profile types:
1. HIGH-SIGNAL (Best): Specific interests, clear vibe, candid photos, revealing prompts
2. SAFE/GENERIC (Most Common): Travel photos, group shots, neutral bios — underperforms
3. ENTERTAINMENT (Polarizing): Humor, bold statements — high match rate but divisive`;

function parseScreenshot(raw: string): { data: string; label: string; mimeType: string } | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed.data && parsed.mimeType) return parsed;
  } catch {}
  return null;
}

function buildUserContent(input: ProfileInput, promptText: string): ChatCompletionContentPart[] {
  const parts: ChatCompletionContentPart[] = [];
  const hasScreenshots = input.screenshots?.length > 0;

  let textContent = promptText + "\n\n";

  if (hasScreenshots) {
    textContent += "The user has uploaded screenshots of their dating profile. Analyze everything visible in the images — bio text, prompts, photos, layout, everything.\n\n";

    input.screenshots.forEach((raw, i) => {
      const s = parseScreenshot(raw);
      if (!s) return;
      const label = s.label ? ` (${s.label})` : "";
      textContent += `Screenshot ${i + 1}${label}:\n`;
    });
    textContent += "\n";
  }

  textContent += buildProfileText(input);

  parts.push({ type: "text", text: textContent });

  if (hasScreenshots) {
    input.screenshots.forEach((raw) => {
      const s = parseScreenshot(raw);
      if (!s) return;
      parts.push({
        type: "image_url",
        image_url: {
          url: `data:${s.mimeType};base64,${s.data}`,
          detail: "high",
        },
      });
    });
  }

  return parts;
}

function buildProfileText(input: ProfileInput): string {
  let message = `Platform: ${input.platform}\n`;

  if (input.bio) {
    message += `\nBio:\n"${input.bio}"\n`;
  }

  if (input.prompts?.length > 0) {
    const filled = input.prompts.filter((p) => p.trim());
    if (filled.length > 0) {
      message += `\nPrompts/Answers:\n`;
      filled.forEach((p, i) => {
        message += `${i + 1}. "${p}"\n`;
      });
    }
  }

  if (input.photoDescriptions?.length > 0) {
    const filled = input.photoDescriptions.filter((p) => p.trim());
    if (filled.length > 0) {
      message += `\nPhoto Descriptions:\n`;
      filled.forEach((p, i) => {
        message += `${i + 1}. ${p}\n`;
      });
    }
  }

  if (input.targetType) {
    message += `\nTarget match type: ${input.customTarget || input.targetType}\n`;
  }

  return message;
}

const ANALYZE_PROMPT = `Analyze this dating profile and give a FREE analysis (score + roast + feedback). Be entertaining and shareable — this is the viral hook.

Respond in this exact JSON format:
{
  "score": {
    "overall": <0-100>,
    "specificity": <0-100 how specific and unique the profile is>,
    "conversationHooks": <0-100 how many natural conversation starters>,
    "authenticity": <0-100 how genuine and human it feels>,
    "photoStrategy": <0-100 how well photos work together>
  },
  "feedback": {
    "roast": "<2-3 sentence witty roast of the profile that's entertaining but not mean — make it shareable on TikTok>",
    "mistakes": ["<specific mistake 1>", "<specific mistake 2>", "<specific mistake 3>"],
    "profileType": "<high-signal | generic | entertainment>",
    "profileTypeExplanation": "<1-2 sentences explaining why they fall in this category>"
  }
}

Remember: The roast should make someone want to share their result. Think "this bio could belong to 4.7 million people" energy.`;

export async function analyzeProfile(input: ProfileInput): Promise<AnalysisResult> {
  const content = buildUserContent(input, ANALYZE_PROMPT);

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content },
    ],
    response_format: { type: "json_object" },
    temperature: 0.8,
  });

  const raw = response.choices[0]?.message?.content || "{}";
  const parsed = JSON.parse(raw);
  return {
    score: {
      overall: parsed.score?.overall ?? 50,
      specificity: parsed.score?.specificity ?? 50,
      conversationHooks: parsed.score?.conversationHooks ?? 50,
      authenticity: parsed.score?.authenticity ?? 50,
      photoStrategy: parsed.score?.photoStrategy ?? 50,
    },
    feedback: {
      roast: parsed.feedback?.roast ?? "Your profile needs some work.",
      mistakes: Array.isArray(parsed.feedback?.mistakes) ? parsed.feedback.mistakes : [],
      profileType: ["high-signal", "generic", "entertainment"].includes(parsed.feedback?.profileType)
        ? parsed.feedback.profileType
        : "generic",
      profileTypeExplanation: parsed.feedback?.profileTypeExplanation ?? "",
    },
    isPaid: false,
  };
}

export async function optimizeProfile(input: ProfileInput): Promise<FullOptimizationResult> {
  const targetDescription = input.customTarget || input.targetType;

  const optimizePrompt = `Give a FULL profile optimization for this dating profile. The user wants to attract: "${targetDescription}"

This is the paid tier — go deep. Rewrite everything to attract their target match type. Adjust tone, remove wrong signals, add the right ones.

Respond in this exact JSON format:
{
  "score": {
    "overall": <0-100>,
    "specificity": <0-100>,
    "conversationHooks": <0-100>,
    "authenticity": <0-100>,
    "photoStrategy": <0-100>
  },
  "feedback": {
    "roast": "<witty 2-3 sentence roast>",
    "mistakes": ["<mistake 1>", "<mistake 2>", "<mistake 3>"],
    "profileType": "<high-signal | generic | entertainment>",
    "profileTypeExplanation": "<explanation>"
  },
  "optimizedBio": "<fully rewritten bio optimized for their target type — high-signal + light humor>",
  "optimizedPrompts": [
    {
      "original": "<their original prompt>",
      "improved": "<rewritten prompt targeting their desired match type>",
      "reason": "<why this works better for attracting their target>"
    }
  ],
  "photoAdvice": [
    {
      "description": "<which photo>",
      "issue": "<what's wrong>",
      "suggestion": "<what to do instead>",
      "recommendedPosition": <1-6 where to place it>
    }
  ],
  "toneAdjustments": ["<specific tone change 1>", "<tone change 2>"],
  "signalsToRemove": ["<signal that attracts wrong people 1>", "<signal 2>"],
  "targetAlignment": "<2-3 sentences explaining how the new profile specifically attracts their target type>"
}

Make the optimized content feel natural, not AI-generated. It should sound like the person but better.`;

  const content = buildUserContent(input, optimizePrompt);

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content },
    ],
    response_format: { type: "json_object" },
    temperature: 0.8,
  });

  const raw = response.choices[0]?.message?.content || "{}";
  const parsed = JSON.parse(raw);
  return {
    score: {
      overall: parsed.score?.overall ?? 50,
      specificity: parsed.score?.specificity ?? 50,
      conversationHooks: parsed.score?.conversationHooks ?? 50,
      authenticity: parsed.score?.authenticity ?? 50,
      photoStrategy: parsed.score?.photoStrategy ?? 50,
    },
    feedback: {
      roast: parsed.feedback?.roast ?? "Your profile needs some work.",
      mistakes: Array.isArray(parsed.feedback?.mistakes) ? parsed.feedback.mistakes : [],
      profileType: ["high-signal", "generic", "entertainment"].includes(parsed.feedback?.profileType)
        ? parsed.feedback.profileType
        : "generic",
      profileTypeExplanation: parsed.feedback?.profileTypeExplanation ?? "",
    },
    optimizedBio: parsed.optimizedBio ?? "",
    optimizedPrompts: Array.isArray(parsed.optimizedPrompts) ? parsed.optimizedPrompts : [],
    photoAdvice: Array.isArray(parsed.photoAdvice) ? parsed.photoAdvice : [],
    toneAdjustments: Array.isArray(parsed.toneAdjustments) ? parsed.toneAdjustments : [],
    signalsToRemove: Array.isArray(parsed.signalsToRemove) ? parsed.signalsToRemove : [],
    targetAlignment: parsed.targetAlignment ?? "",
    isPaid: true,
  };
}
