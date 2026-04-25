export type SuggestionKind = "question" | "talking" | "answer" | "fact";
export type ChatMessageRole = "user" | "assistant";
export type ChatMessageSource = "typed" | "suggestion";
export type RefreshReason = "auto" | "manual" | "stop";
export type ReasoningEffort = "low" | "medium" | "high";

export interface TranscriptChunk {
  id: string;
  text: string;
  timestamp: string;
  startedAtMs: number;
  endedAtMs: number;
  source: "mic";
}

export interface Suggestion {
  id: string;
  kind: SuggestionKind;
  preview: string;
  whyNow: string;
  quoteAnchor: string;
}

export interface SuggestionBatch {
  id: string;
  createdAt: string;
  refreshReason: RefreshReason;
  suggestions: Suggestion[];
}

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  source: ChatMessageSource;
  text: string;
  timestamp: string;
  suggestionId?: string;
  suggestionKind?: SuggestionKind;
  status?: "streaming" | "done" | "error";
}

export interface RollingMeetingMemory {
  summary: string;
  decisions: string[];
  openQuestions: string[];
  risks: string[];
  entities: string[];
  updatedAt: string | null;
}

export interface FailureEvent {
  id: string;
  timestamp: string;
  kind: "transcription" | "suggestions" | "chat" | "memory" | "validation";
  message: string;
  retried: boolean;
}

export interface AppSettings {
  apiKey: string;
  language: string;
  refreshIntervalSeconds: number;
  suggestionTranscriptWindow: number;
  answerTranscriptWindow: number;
  chatHistoryWindow: number;
  suggestionReasoningEffort: ReasoningEffort;
  chatReasoningEffort: ReasoningEffort;
  suggestionMaxOutputTokens: number;
  chatMaxOutputTokens: number;
  liveSuggestionPrompt: string;
  clickedSuggestionPrompt: string;
  directChatPrompt: string;
  transcriptionBiasPrompt: string;
}

export interface SessionMetrics {
  refreshLatencyMs: number[];
  chatFirstTokenLatencyMs: number[];
}

export interface SessionExport {
  exportedAt: string;
  sessionStartedAt: string;
  settings: Omit<AppSettings, "apiKey">;
  transcript: TranscriptChunk[];
  suggestionBatches: SuggestionBatch[];
  chatHistory: ChatMessage[];
  rollingMemory: RollingMeetingMemory;
  metrics: SessionMetrics;
  failures: FailureEvent[];
}

export interface SuggestionRequestPayload {
  settings: AppSettings;
  transcript: TranscriptChunk[];
  recentBatches: SuggestionBatch[];
  rollingMemory: RollingMeetingMemory;
}

export interface SuggestionResponsePayload {
  batch: SuggestionBatch;
  modelTimingMs?: number;
}

export interface MemoryResponsePayload {
  memory: RollingMeetingMemory;
}
