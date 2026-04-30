import { v } from "convex/values";
import { action } from "./_generated/server";
import { requireAuth } from "./lib/auth";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-4-6";

const QUESTION_CAP = 3;

export type RefinementQuestion = {
  id: string;
  prompt: string;
  type: "choice" | "text";
  options?: string[];
  multiSelect?: boolean;
  placeholder?: string;
  summarizePattern: string;
};

const buildAnalyzeSystemPrompt = (args: {
  countryName: string;
  duration: number;
  vibes: string[];
  userNotes: string;
}) => `You are a thoughtful travel-planning assistant analyzing a user's trip brief to decide whether you need clarifying questions before generating their itinerary.

The user is planning a trip:
- Destination: ${args.countryName}
- Duration: ${args.duration} days
- Vibes selected: ${args.vibes.length > 0 ? args.vibes.join(", ") : "none"}

The user wrote this in their own words:
"${args.userNotes}"

YOUR JOB: decide whether to ask 0–3 clarifying questions.

ASK when:
- The brief mentions a category without specifics (e.g., "I like nature" — but what KIND of nature?).
- A preference has multiple plausible interpretations (active vs. relaxed; mountains vs. beaches; deep-dive vs. broad sampler).
- The user mentions something specific that you need a detail on to honor it well (e.g., "must include a special anniversary dinner" — what kind?).

DO NOT ASK when:
- The brief is already specific enough to plan a great trip on.
- The information is already covered by the structured fields above. NEVER ask about country, duration, party size, or dates.
- Asking would feel redundant or perfunctory.

CAP: ${QUESTION_CAP} questions max. Fewer is better. Each question must materially affect the itinerary. Rank highest-impact first — the client trims past ${QUESTION_CAP} if you exceed.

QUESTION FORMAT — pick per question based on what's natural:
- 'choice' for things with discrete answers (active vs. relaxed; nature types). Provide 2–5 options as standalone descriptive phrases — never "Yes"/"No". Set multiSelect: true if the user could reasonably want multiple.
- 'text' for things that benefit from prose (must-include places, special occasions, deal-breakers).

For each question, provide a summarizePattern:
- A short template that turns the answer into a brief lowercase fragment starting with a verb or preposition.
- {answer} placeholder is replaced with the lowercased option text (or typed text for 'text' questions). Proper nouns the user typed are preserved.
- For multi-select, {answer} expands to "X and Y" (2 picks) or "X, Y, and Z" (3+, Oxford comma).
- The pattern + options must read as natural English when interpolated. Pick options and pattern together so the merged prose flows.

Examples:
  Q: "What kind of nature draws you most?" (multi-select)
  options: ["mountains and hiking", "beaches and coast", "forests and wildlife"]
  pattern: "drawn to {answer}"

  Q: "Active or relaxed pace?" (single)
  options: ["an active pace", "a relaxed pace"]
  pattern: "preferring {answer}"

  Q: "Anything specific you want to include?" (text)
  pattern: "must include {answer}"

OUTPUT:
Return ONLY a JSON object matching this exact shape — no preamble, no markdown fences, no commentary:

{
  "questions": [
    {
      "id": "string",
      "prompt": "string",
      "type": "choice" | "text",
      "options": ["..."],            // present iff type==='choice'
      "multiSelect": true | false,   // present iff type==='choice'
      "placeholder": "string",       // present iff type==='text'
      "summarizePattern": "..."
    }
  ]
}

If no questions are warranted, return { "questions": [] }.`;

export const analyzeUserNotes = action({
  args: {
    countryCode: v.string(),
    countryName: v.string(),
    duration: v.number(),
    vibes: v.array(v.string()),
    userNotes: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ questions: RefinementQuestion[] }> => {
    await requireAuth(ctx);

    const trimmed = args.userNotes.trim();
    if (trimmed.length === 0) {
      // Defensive: client shouldn't call with empty notes, but if it does,
      // we have no questions to ask.
      return { questions: [] };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }

    const systemPrompt = buildAnalyzeSystemPrompt({
      countryName: args.countryName,
      duration: args.duration,
      vibes: args.vibes,
      userNotes: trimmed,
    });

    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `User notes: "${trimmed}". Analyze and return your questions JSON now.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Anthropic API error ${response.status}: ${text.slice(0, 500)}`,
      );
    }

    const body = (await response.json()) as {
      content: Array<{ type: string; text?: string }>;
    };
    const text = body.content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");

    const parsed = parseQuestionsResponse(text);
    return { questions: parsed.slice(0, QUESTION_CAP) };
  },
});

function parseQuestionsResponse(raw: string): RefinementQuestion[] {
  const trimmed = raw.trim();
  // Strip optional code fences in case the model adds them despite instructions
  const stripped = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    // If the model returned something we can't parse, treat as no questions
    // — the client falls through to direct generation.
    return [];
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("questions" in parsed)
  ) {
    return [];
  }
  const questions = (parsed as { questions: unknown }).questions;
  if (!Array.isArray(questions)) return [];

  return questions.filter(isRefinementQuestion);
}

function isRefinementQuestion(value: unknown): value is RefinementQuestion {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string") return false;
  if (typeof v.prompt !== "string") return false;
  if (v.type !== "choice" && v.type !== "text") return false;
  if (typeof v.summarizePattern !== "string") return false;
  if (v.type === "choice") {
    if (!Array.isArray(v.options)) return false;
    if (!v.options.every((o) => typeof o === "string")) return false;
  }
  return true;
}
