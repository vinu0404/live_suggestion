import { NextResponse } from "next/server";
import { GROQ_BASE_URL, GROQ_TRANSCRIPTION_MODEL, groqAuthHeaders, parseGroqError } from "@/lib/groq";
import { createId, nowIso } from "@/lib/utils";

export const runtime = "nodejs";

interface TranscriptionResponse {
  text?: string;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const apiKey = formData.get("apiKey");
    const file = formData.get("file");
    const language = formData.get("language");
    const prompt = formData.get("prompt");
    const startedAtMs = Number(formData.get("startedAtMs"));
    const endedAtMs = Number(formData.get("endedAtMs"));

    if (typeof apiKey !== "string" || apiKey.length === 0) {
      return NextResponse.json({ error: "Groq API key is required." }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Audio file is required." }, { status: 400 });
    }

    const upstreamForm = new FormData();
    upstreamForm.append("file", file, file.name || "chunk.webm");
    upstreamForm.append("model", GROQ_TRANSCRIPTION_MODEL);

    if (typeof language === "string" && language.trim()) {
      upstreamForm.append("language", language.trim());
    }

    if (typeof prompt === "string" && prompt.trim()) {
      upstreamForm.append("prompt", prompt.trim());
    }

    const response = await fetch(`${GROQ_BASE_URL}/audio/transcriptions`, {
      method: "POST",
      headers: groqAuthHeaders(apiKey),
      body: upstreamForm,
      cache: "no-store",
    });

    if (!response.ok) {
      const message = await parseGroqError(response);

      return NextResponse.json({ error: message }, { status: response.status });
    }

    const data = (await response.json()) as TranscriptionResponse;

    return NextResponse.json({
      chunk: {
        id: createId("transcript"),
        text: data.text?.trim() ?? "",
        timestamp: nowIso(),
        startedAtMs: Number.isFinite(startedAtMs) ? startedAtMs : 0,
        endedAtMs: Number.isFinite(endedAtMs) ? endedAtMs : 0,
        source: "mic",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to transcribe audio." },
      { status: 500 },
    );
  }
}
