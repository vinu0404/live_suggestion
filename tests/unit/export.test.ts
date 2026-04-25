import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, EMPTY_MEMORY } from "@/lib/defaults";
import { buildSessionExport } from "@/lib/export-session";

describe("buildSessionExport", () => {
  it("omits the api key and preserves session artifacts", () => {
    const exportPayload = buildSessionExport({
      sessionStartedAt: "2026-04-16T12:00:00.000Z",
      settings: {
        ...DEFAULT_SETTINGS,
        apiKey: "secret-key",
      },
      transcript: [],
      suggestionBatches: [],
      chatHistory: [],
      rollingMemory: EMPTY_MEMORY,
      metrics: {
        refreshLatencyMs: [1200],
        chatFirstTokenLatencyMs: [640],
      },
      failures: [],
    });

    expect(exportPayload.settings).not.toHaveProperty("apiKey");
    expect(exportPayload.metrics.refreshLatencyMs).toEqual([1200]);
  });
});
