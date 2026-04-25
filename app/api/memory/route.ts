import { NextResponse } from "next/server";
import { z } from "zod";
import { buildMemoryInstructions } from "@/lib/prompts";
import { GROQ_BASE_URL, GROQ_SUGGESTION_MODEL, groqJsonHeaders, parseGroqError } from "@/lib/groq";
import { selectRecentTranscript } from "@/lib/context";
import type { RollingMeetingMemory } from "@/lib/types";
import { nowIso } from "@/lib/utils";

export const runtime = "nodejs";

const requestSchema = z.object({
  apiKey: z.string().min(1),
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
  rollingMemory: z.object({
    summary: z.string(),
    decisions: z.array(z.string()),
    openQuestions: z.array(z.string()),
    risks: z.array(z.string()),
    entities: z.array(z.string()),
    updatedAt: z.string().nullable(),
  }),
});

const memorySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    decisions: { type: "array", items: { type: "string" } },
    openQuestions: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    entities: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "decisions", "openQuestions", "risks", "entities"],
};

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const transcriptWindow = selectRecentTranscript(body.transcript, 20);

    const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: groqJsonHeaders(body.apiKey),
      body: JSON.stringify({
        model: GROQ_SUGGESTION_MODEL,
        messages: [
          {
            role: "system",
            content: buildMemoryInstructions(transcriptWindow, body.rollingMemory),
          },
          {
            role: "user",
            content: "Update the rolling meeting memory.",
          },
        ],
        reasoning_effort: "low",
        max_completion_tokens: 700,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "rolling_meeting_memory",
            strict: true,
            schema: memorySchema,
          },
        },
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const message = await parseGroqError(response);
      return NextResponse.json({ error: message }, { status: response.status });
    }

    const json = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };
    const content = json.choices?.[0]?.message?.content;
    const memory = JSON.parse(content ?? "{}") as Omit<RollingMeetingMemory, "updatedAt">;

    return NextResponse.json({
      memory: {
        ...memory,
        updatedAt: nowIso(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update rolling memory." },
      { status: 500 },
    );
  }
}
