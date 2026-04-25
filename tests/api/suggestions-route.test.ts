import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/suggestions/route";
import { DEFAULT_SETTINGS, EMPTY_MEMORY } from "@/lib/defaults";
import type { SuggestionBatch, TranscriptChunk } from "@/lib/types";

describe("/api/suggestions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retries when the first batch duplicates recent suggestions", async () => {
    const transcript: TranscriptChunk[] = [
      {
        id: "t1",
        text: "We are discussing shard keys and monthly Kafka cost.",
        timestamp: "2026-04-16T12:00:00.000Z",
        startedAtMs: 0,
        endedAtMs: 1000,
        source: "mic",
      },
    ];

    const recentBatches: SuggestionBatch[] = [
      {
        id: "b1",
        createdAt: "2026-04-16T11:59:00.000Z",
        refreshReason: "auto",
        suggestions: [
          {
            id: "s1",
            kind: "question",
            preview: "What is the current p99 latency?",
            whyNow: "Latency was just discussed.",
            quoteAnchor: "latency",
          },
        ],
      },
    ];

    const fetchMock = vi.spyOn(global, "fetch");
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    suggestions: [
                      {
                        kind: "question",
                        preview: "What is the current p99 latency?",
                        whyNow: "Duplicate on purpose.",
                        quoteAnchor: "latency",
                      },
                      {
                        kind: "talking",
                        preview: "Cohort sharding may break under viral spikes.",
                        whyNow: "The cohort idea came up.",
                        quoteAnchor: "user cohort",
                      },
                      {
                        kind: "fact",
                        preview: "Slack outages are often config-driven, not pure capacity misses.",
                        whyNow: "Reliability risk came up.",
                        quoteAnchor: "Slack went down",
                      },
                    ],
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    suggestions: [
                      {
                        kind: "question",
                        preview: "Ask which shard key stays stable when traffic surges.",
                        whyNow: "They are deciding how to shard.",
                        quoteAnchor: "shard by guild ID",
                      },
                      {
                        kind: "answer",
                        preview: "Managed Kafka at this scale can reach five figures monthly.",
                        whyNow: "Cost was asked explicitly.",
                        quoteAnchor: "realistic monthly bill",
                      },
                      {
                        kind: "fact",
                        preview: "Config rollout failures and capacity failures need different mitigations.",
                        whyNow: "They referenced Slack outages.",
                        quoteAnchor: "avoid that pattern",
                      },
                    ],
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      );

    const response = await POST(
      new Request("http://localhost/api/suggestions", {
        method: "POST",
        body: JSON.stringify({
          settings: {
            ...DEFAULT_SETTINGS,
            apiKey: "gsk_test",
          },
          transcript,
          recentBatches,
          rollingMemory: EMPTY_MEMORY,
          refreshReason: "manual",
        }),
      }),
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.batch.suggestions).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(body.batch.suggestions[0].preview).toContain("Ask which shard key");
  });
});
