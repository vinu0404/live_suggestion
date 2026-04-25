import { describe, expect, it } from "vitest";
import { coerceSuggestionBatch, collectRecentSuggestionSet, isSuggestionDistinct, normalizeSuggestionText } from "@/lib/suggestions";
import type { SuggestionBatch } from "@/lib/types";

describe("suggestion helpers", () => {
  it("normalizes suggestion previews for duplicate detection", () => {
    expect(normalizeSuggestionText("What’s the p99 latency?")).toBe("what s the p99 latency");
  });

  it("rejects previews already present in recent batches", () => {
    const recentBatches: SuggestionBatch[] = [
      {
        id: "batch_1",
        createdAt: "2026-04-16T12:00:00.000Z",
        refreshReason: "auto",
        suggestions: [
          {
            id: "s_1",
            kind: "question",
            preview: "What is the current p99 latency?",
            whyNow: "Latency was just mentioned.",
            quoteAnchor: "p99 latency",
          },
        ],
      },
    ];

    const seen = collectRecentSuggestionSet(recentBatches);
    expect(
      isSuggestionDistinct(
        {
          id: "candidate",
          kind: "question",
          preview: "What is the current p99 latency?",
          whyNow: "Same idea.",
          quoteAnchor: "latency",
        },
        seen,
      ),
    ).toBe(false);
  });

  it("coerces structured model output into an app batch", () => {
    const batch = coerceSuggestionBatch(
      {
        suggestions: [
          {
            kind: "question",
            preview: "Ask which shard key is most stable.",
            whyNow: "Sharding came up directly.",
            quoteAnchor: "shard by guild ID",
          },
          {
            kind: "talking",
            preview: "Cohort sharding breaks during viral spikes.",
            whyNow: "The team mentioned user cohorts.",
            quoteAnchor: "user cohort",
          },
          {
            kind: "fact",
            preview: "Slack outages are often config-driven, not pure capacity misses.",
            whyNow: "They referenced Slack reliability.",
            quoteAnchor: "when Slack went down",
          },
        ],
      },
      "2026-04-16T12:00:00.000Z",
      "manual",
    );

    expect(batch.suggestions).toHaveLength(3);
    expect(batch.refreshReason).toBe("manual");
  });
});
