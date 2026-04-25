import type { ChatMessage, RollingMeetingMemory, SuggestionBatch, TranscriptChunk } from "@/lib/types";

export function selectRecentTranscript(transcript: TranscriptChunk[], windowSize: number) {
  if (windowSize <= 0) {
    return [];
  }

  return transcript.slice(-windowSize);
}

export function selectRecentChatHistory(history: ChatMessage[], windowSize: number) {
  if (windowSize <= 0) {
    return [];
  }

  return history.slice(-windowSize);
}

export function selectRecentBatches(batches: SuggestionBatch[], windowSize = 2) {
  if (windowSize <= 0) {
    return [];
  }

  return batches.slice(0, windowSize);
}

export function transcriptToContext(transcript: TranscriptChunk[]) {
  if (transcript.length === 0) {
    return "No transcript yet.";
  }

  return transcript
    .map((chunk) => `[${new Date(chunk.timestamp).toLocaleTimeString()}] ${chunk.text}`)
    .join("\n");
}

export function chatHistoryToContext(history: ChatMessage[]) {
  if (history.length === 0) {
    return "No chat history yet.";
  }

  return history.map((message) => `${message.role.toUpperCase()}: ${message.text}`).join("\n");
}

export function memoryToContext(memory: RollingMeetingMemory) {
  if (!memory.summary && memory.decisions.length === 0 && memory.openQuestions.length === 0 && memory.risks.length === 0) {
    return "No rolling memory yet.";
  }

  return [
    `Summary: ${memory.summary || "n/a"}`,
    `Decisions: ${memory.decisions.join("; ") || "n/a"}`,
    `Open Questions: ${memory.openQuestions.join("; ") || "n/a"}`,
    `Risks: ${memory.risks.join("; ") || "n/a"}`,
    `Entities: ${memory.entities.join("; ") || "n/a"}`,
  ].join("\n");
}

export function batchesToContext(batches: SuggestionBatch[]) {
  if (batches.length === 0) {
    return "No previous suggestion batches.";
  }

  return batches
    .map(
      (batch) =>
        `Batch ${batch.createdAt}:\n${batch.suggestions
          .map((suggestion) => `- ${suggestion.kind}: ${suggestion.preview}`)
          .join("\n")}`,
    )
    .join("\n\n");
}
