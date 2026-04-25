import { NextResponse } from "next/server";
import { z } from "zod";
import { GROQ_BASE_URL, parseGroqError } from "@/lib/groq";

export const runtime = "nodejs";

const requestSchema = z.object({
  apiKey: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());

    const response = await fetch(`${GROQ_BASE_URL}/models`, {
      headers: {
        Authorization: `Bearer ${body.apiKey}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const message = await parseGroqError(response);

      return NextResponse.json({ error: message }, { status: response.status });
    }

    const models = (await response.json()) as { data?: Array<{ id?: string }> };
    const modelIds = new Set((models.data ?? []).map((entry) => entry.id).filter(Boolean));

    return NextResponse.json({
      ok: true,
      supports: {
        transcription: modelIds.has("whisper-large-v3"),
        suggestions: modelIds.has("openai/gpt-oss-120b"),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request." },
      { status: 400 },
    );
  }
}
