import { NextResponse } from "next/server";
import { z } from "zod";
import { buildSuggestionInstructions } from "@/lib/prompts";
import { GROQ_BASE_URL, GROQ_SUGGESTION_MODEL, groqJsonHeaders, parseGroqError } from "@/lib/groq";
import { selectRecentBatches, selectRecentTranscript } from "@/lib/context";
import {
  coerceSuggestionBatch,
  collectRecentSuggestionSet,
  isSuggestionDistinct,
} from "@/lib/suggestions";
import type { SuggestionBatch, SuggestionRequestPayload } from "@/lib/types";
import { nowIso } from "@/lib/utils";

export const runtime = "nodejs";

const requestSchema = z.object({
  settings: z.object({
    apiKey: z.string().min(1),
    language: z.string(),
    refreshIntervalSeconds: z.number(),
    suggestionTranscriptWindow: z.number(),
    answerTranscriptWindow: z.number(),
    chatHistoryWindow: z.number(),
    suggestionReasoningEffort: z.enum(["low", "medium", "high"]),
    chatReasoningEffort: z.enum(["low", "medium", "high"]),
    suggestionMaxOutputTokens: z.number(),
    chatMaxOutputTokens: z.number(),
    liveSuggestionPrompt: z.string(),
    clickedSuggestionPrompt: z.string(),
    directChatPrompt: z.string(),
    transcriptionBiasPrompt: z.string(),
  }),
  transcript: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      timestamp: z.string(),
      startedAtMs: z.number(),
      endedAtMs: z.number(),
      source: z.literal("mic"),
    }),
  ),
  recentBatches: z.array(
    z.object({
      id: z.string(),
      createdAt: z.string(),
      refreshReason: z.enum(["auto", "manual", "stop"]),
      suggestions: z.array(
        z.object({
          id: z.string(),
          kind: z.enum(["question", "talking", "answer", "fact"]),
          preview: z.string(),
          whyNow: z.string(),
          quoteAnchor: z.string(),
        }),
      ),
    }),
  ),
  rollingMemory: z.object({
    summary: z.string(),
    decisions: z.array(z.string()),
    openQuestions: z.array(z.string()),
    risks: z.array(z.string()),
    entities: z.array(z.string()),
    updatedAt: z.string().nullable(),
  }),
  refreshReason: z.enum(["auto", "manual", "stop"]),
});

const suggestionResponseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    suggestions: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          kind: {
            type: "string",
            enum: ["question", "talking", "answer", "fact"],
          },
          preview: {
            type: "string",
          },
          whyNow: {
            type: "string",
          },
          quoteAnchor: {
            type: "string",
          },
        },
        required: ["kind", "preview", "whyNow", "quoteAnchor"],
      },
    },
  },
  required: ["suggestions"],
};

async function runSuggestionGeneration(
  payload: SuggestionRequestPayload,
  duplicateHints: string[],
  refreshReason: SuggestionBatch["refreshReason"],
) {
  const transcript = selectRecentTranscript(payload.transcript, payload.settings.suggestionTranscriptWindow);
  const recentBatches = selectRecentBatches(payload.recentBatches);

  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: groqJsonHeaders(payload.settings.apiKey, true),
    body: JSON.stringify({
      model: GROQ_SUGGESTION_MODEL,
      messages: [
        {
          role: "system",
          content: buildSuggestionInstructions(
            payload.settings,
            transcript,
            payload.rollingMemory,
            recentBatches,
            duplicateHints,
          ),
        },
        {
          role: "user",
          content: "Produce the live suggestion batch now.",
        },
      ],
      reasoning_effort: payload.settings.suggestionReasoningEffort,
      max_completion_tokens: payload.settings.suggestionMaxOutputTokens,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "live_suggestion_batch",
          strict: true,
          schema: suggestionResponseSchema,
        },
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await parseGroqError(response);
    throw new Error(message);
  }

  const json = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
    usage?: {
      total_time?: number;
    };
    x_groq?: {
      usage?: {
        total_time?: number;
      };
    };
  };
  const content = json.choices?.[0]?.message?.content;
  const batch = coerceSuggestionBatch(JSON.parse(content ?? "{}"), nowIso(), refreshReason);

  return {
    batch,
    modelTimingMs: json.x_groq?.usage?.total_time ?? json.usage?.total_time,
  };
}

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const recentSet = collectRecentSuggestionSet(selectRecentBatches(body.recentBatches));

    const firstPass = await runSuggestionGeneration(body, [], body.refreshReason);
    const uniqueFirstPass = firstPass.batch.suggestions.filter((suggestion) => isSuggestionDistinct(suggestion, recentSet));

    if (uniqueFirstPass.length === firstPass.batch.suggestions.length) {
      return NextResponse.json(firstPass);
    }

    const retryHints = [
      ...Array.from(recentSet),
      ...firstPass.batch.suggestions.map((suggestion) => suggestion.preview),
    ];

    const secondPass = await runSuggestionGeneration(body, retryHints, body.refreshReason);

    return NextResponse.json(secondPass);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate suggestions." },
      { status: 500 },
    );
  }
}
