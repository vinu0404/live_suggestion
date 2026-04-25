import type { AppSettings, RollingMeetingMemory, SuggestionKind } from "@/lib/types";

export const DEFAULT_REFRESH_INTERVAL_SECONDS = 30;
export const DEFAULT_SUGGESTION_WINDOW = 8;
export const DEFAULT_ANSWER_WINDOW = 18;
export const DEFAULT_CHAT_HISTORY_WINDOW = 10;

export const SUGGESTION_KIND_LABELS: Record<SuggestionKind, string> = {
  question: "Question to ask",
  talking: "Talking point",
  answer: "Answer",
  fact: "Fact-check",
};

export const EMPTY_MEMORY: RollingMeetingMemory = {
  summary: "",
  decisions: [],
  openQuestions: [],
  risks: [],
  entities: [],
  updatedAt: null,
};

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: "",
  language: "en",
  refreshIntervalSeconds: DEFAULT_REFRESH_INTERVAL_SECONDS,
  suggestionTranscriptWindow: DEFAULT_SUGGESTION_WINDOW,
  answerTranscriptWindow: DEFAULT_ANSWER_WINDOW,
  chatHistoryWindow: DEFAULT_CHAT_HISTORY_WINDOW,
  suggestionReasoningEffort: "low",
  chatReasoningEffort: "medium",
  suggestionMaxOutputTokens: 900,
  chatMaxOutputTokens: 1800,
  liveSuggestionPrompt:
    "You are a real-time meeting copilot. Study the recent transcript, the rolling meeting memory, and the last two suggestion batches. Produce exactly 3 suggestions that would genuinely help the speaker in the next 10-30 seconds. Mix suggestion types when useful: a question to ask, a talking point, an answer to a question that was asked, or a fact-check / clarification. Optimize for immediate utility, not generic brainstorming. Every preview should stand alone and already be useful even if it is never clicked. Avoid repeating earlier suggestions or paraphrasing them. Anchor each suggestion in the transcript. If context is thin, prefer a clarifying question or concise synthesis over filler.",
  clickedSuggestionPrompt:
    "You are a high-agency meeting copilot expanding a clicked live suggestion into a detailed answer. Use the full transcript context, rolling memory, and the clicked suggestion metadata. Be concrete, timely, and action-oriented. Separate facts from assumptions. If the suggestion is a fact-check, call out uncertainty clearly. Keep the answer easy to scan in a live conversation.",
  directChatPrompt:
    "You are a meeting copilot answering direct user questions during a live conversation. Use transcript context, chat history, and rolling memory to answer precisely. Prioritize what helps right now: concise explanations, next questions to ask, tradeoffs, and decision support. Be candid about uncertainty instead of hallucinating.",
  transcriptionBiasPrompt:
    "Prefer accurate transcription of product names, technical jargon, company names, and proper nouns. Keep punctuation readable. Do not invent words that are not present in the audio.",
};
