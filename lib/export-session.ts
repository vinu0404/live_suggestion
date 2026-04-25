import type { AppSettings, ChatMessage, FailureEvent, RollingMeetingMemory, SessionExport, SessionMetrics, SuggestionBatch, TranscriptChunk } from "@/lib/types";

export function buildSessionExport(params: {
  sessionStartedAt: string;
  settings: AppSettings;
  transcript: TranscriptChunk[];
  suggestionBatches: SuggestionBatch[];
  chatHistory: ChatMessage[];
  rollingMemory: RollingMeetingMemory;
  metrics: SessionMetrics;
  failures: FailureEvent[];
}): SessionExport {
  const { settings, ...rest } = params;
  const { apiKey: _apiKey, ...exportableSettings } = settings;

  return {
    exportedAt: new Date().toISOString(),
    sessionStartedAt: rest.sessionStartedAt,
    settings: exportableSettings,
    transcript: rest.transcript,
    suggestionBatches: rest.suggestionBatches,
    chatHistory: rest.chatHistory,
    rollingMemory: rest.rollingMemory,
    metrics: rest.metrics,
    failures: rest.failures,
  };
}
