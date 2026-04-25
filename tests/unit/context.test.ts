import { describe, expect, it } from "vitest";
import { chatHistoryToContext, memoryToContext, selectRecentTranscript, transcriptToContext } from "@/lib/context";
import type { ChatMessage, RollingMeetingMemory, TranscriptChunk } from "@/lib/types";

function transcriptChunk(id: string, text: string): TranscriptChunk {
  return {
    id,
    text,
    timestamp: "2026-04-16T12:00:00.000Z",
    startedAtMs: 0,
    endedAtMs: 1000,
    source: "mic",
  };
}

describe("context helpers", () => {
  it("selects the most recent transcript window", () => {
    const transcript = [
      transcriptChunk("1", "alpha"),
      transcriptChunk("2", "beta"),
      transcriptChunk("3", "gamma"),
    ];

    expect(selectRecentTranscript(transcript, 2).map((chunk) => chunk.id)).toEqual(["2", "3"]);
  });

  it("formats transcript and chat context for prompts", () => {
    const transcript = [transcriptChunk("1", "We need pricing for Kafka.")];
    const chatHistory: ChatMessage[] = [
      {
        id: "chat_1",
        role: "user",
        source: "typed",
        text: "What should I ask next?",
        timestamp: "2026-04-16T12:01:00.000Z",
        status: "done",
      },
    ];

    expect(transcriptToContext(transcript)).toContain("We need pricing for Kafka.");
    expect(chatHistoryToContext(chatHistory)).toContain("USER: What should I ask next?");
  });

  it("formats rolling memory safely when fields are sparse", () => {
    const memory: RollingMeetingMemory = {
      summary: "The team is discussing backend scaling.",
      decisions: [],
      openQuestions: ["What is the monthly cost?"],
      risks: [],
      entities: ["Kafka"],
      updatedAt: null,
    };

    expect(memoryToContext(memory)).toContain("Summary: The team is discussing backend scaling.");
    expect(memoryToContext(memory)).toContain("Open Questions: What is the monthly cost?");
  });
});
