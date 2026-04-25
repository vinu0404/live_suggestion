import { NextResponse } from "next/server";
import { z } from "zod";
import { buildChatMessages } from "@/lib/prompts";
import { GROQ_BASE_URL, GROQ_CHAT_MODEL, groqJsonHeaders, parseGroqError } from "@/lib/groq";
import { selectRecentChatHistory, selectRecentTranscript } from "@/lib/context";

export const runtime = "nodejs";

const requestSchema = z.object({
  settings: z.object({
    apiKey: z.string().min(1),
    answerTranscriptWindow: z.number(),
    chatHistoryWindow: z.number(),
    chatReasoningEffort: z.enum(["low", "medium", "high"]),
    chatMaxOutputTokens: z.number(),
    clickedSuggestionPrompt: z.string(),
    directChatPrompt: z.string(),
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
  rollingMemory: z.object({
    summary: z.string(),
    decisions: z.array(z.string()),
    openQuestions: z.array(z.string()),
    risks: z.array(z.string()),
    entities: z.array(z.string()),
    updatedAt: z.string().nullable(),
  }),
  history: z.array(
    z.object({
      id: z.string(),
      role: z.enum(["user", "assistant"]),
      source: z.enum(["typed", "suggestion"]),
      text: z.string(),
      timestamp: z.string(),
      suggestionId: z.string().optional(),
      suggestionKind: z.enum(["question", "talking", "answer", "fact"]).optional(),
      status: z.enum(["streaming", "done", "error"]).optional(),
    }),
  ),
  question: z.string().min(1),
  mode: z.enum(["typed", "suggestion"]),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const transcript = selectRecentTranscript(body.transcript, body.settings.answerTranscriptWindow);
    const history = selectRecentChatHistory(
      body.history.filter((message) => message.status !== "streaming"),
      body.settings.chatHistoryWindow,
    );
    const prompt = body.mode === "suggestion" ? body.settings.clickedSuggestionPrompt : body.settings.directChatPrompt;

    const upstream = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: groqJsonHeaders(body.settings.apiKey),
      body: JSON.stringify({
        model: GROQ_CHAT_MODEL,
        messages: buildChatMessages({
          prompt,
          transcript,
          rollingMemory: body.rollingMemory,
          history,
          question: body.question,
        }),
        stream: true,
        max_completion_tokens: body.settings.chatMaxOutputTokens,
        temperature: 0.35,
        reasoning_effort: body.settings.chatReasoningEffort,
      }),
      cache: "no-store",
    });

    if (!upstream.ok || !upstream.body) {
      const message = await parseGroqError(upstream);
      return NextResponse.json({ error: message }, { status: upstream.status || 500 });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to stream chat response." },
      { status: 500 },
    );
  }
}
