import { z } from "zod";

export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const GROQ_SUGGESTION_MODEL = "openai/gpt-oss-120b";
export const GROQ_CHAT_MODEL = "openai/gpt-oss-120b";
export const GROQ_TRANSCRIPTION_MODEL = "whisper-large-v3";

const groqErrorSchema = z.object({
  error: z
    .object({
      message: z.string(),
      type: z.string().optional(),
      code: z.string().optional(),
    })
    .optional(),
});

export function groqJsonHeaders(apiKey: string, includeInferenceMetrics = false) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    ...(includeInferenceMetrics ? { "Groq-Beta": "inference-metrics" } : {}),
  };
}

export function groqAuthHeaders(apiKey: string, includeInferenceMetrics = false) {
  return {
    Authorization: `Bearer ${apiKey}`,
    ...(includeInferenceMetrics ? { "Groq-Beta": "inference-metrics" } : {}),
  };
}

export async function parseGroqError(response: Response) {
  const rawText = await response.text();

  try {
    const parsed = groqErrorSchema.parse(JSON.parse(rawText));
    return parsed.error?.message ?? rawText;
  } catch {
    return rawText || `Groq request failed with status ${response.status}`;
  }
}
