import type { AppSettings, ChatMessage, RollingMeetingMemory, SuggestionBatch, TranscriptChunk } from "@/lib/types";
import { batchesToContext, chatHistoryToContext, memoryToContext, transcriptToContext } from "@/lib/context";

export function buildSuggestionInstructions(
  settings: AppSettings,
  transcript: TranscriptChunk[],
  rollingMemory: RollingMeetingMemory,
  recentBatches: SuggestionBatch[],
  duplicateHints: string[],
) {
  return [
    settings.liveSuggestionPrompt,
    "",
    "Output contract:",
    "- Return valid JSON that matches the schema.",
    "- Exactly 3 suggestions.",
    "- Each suggestion must have kind, preview, whyNow, quoteAnchor.",
    "- Keep preview crisp and immediately useful.",
    "- Make the three suggestions materially different from one another.",
    duplicateHints.length > 0
      ? `- Do not repeat or paraphrase any of these previews: ${duplicateHints.join(" | ")}`
      : "- Avoid repeating previous suggestion batches.",
    "",
    "Rolling memory:",
    memoryToContext(rollingMemory),
    "",
    "Recent transcript:",
    transcriptToContext(transcript),
    "",
    "Recent batches to avoid repeating:",
    batchesToContext(recentBatches),
  ].join("\n");
}

export function buildMemoryInstructions(transcript: TranscriptChunk[], rollingMemory: RollingMeetingMemory) {
  return [
    "You are maintaining a rolling meeting memory for a live copilot.",
    "Compress stable context only. Keep it terse, factual, and durable across the session.",
    "Return valid JSON with summary, decisions, openQuestions, risks, and entities.",
    "Do not include ephemeral wording that will go stale in seconds.",
    "",
    "Current memory:",
    memoryToContext(rollingMemory),
    "",
    "Transcript to absorb:",
    transcriptToContext(transcript),
  ].join("\n");
}

export function buildChatMessages(params: {
  prompt: string;
  transcript: TranscriptChunk[];
  rollingMemory: RollingMeetingMemory;
  history: ChatMessage[];
  question: string;
}) {
  const { prompt, transcript, rollingMemory, history, question } = params;

  return [
    {
      role: "system",
      content: [
        prompt,
        "",
        "Rolling memory:",
        memoryToContext(rollingMemory),
        "",
        "Recent transcript:",
        transcriptToContext(transcript),
        "",
        "Recent chat history:",
        chatHistoryToContext(history),
      ].join("\n"),
    },
    {
      role: "user",
      content: question,
    },
  ];
}
