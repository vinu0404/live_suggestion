import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    class FakeMediaRecorder {
      static isTypeSupported(type: string) {
        return type.includes("audio/");
      }

      public state = "inactive";
      public mimeType = "audio/webm";
      public ondataavailable: ((event: { data: Blob }) => void) | null = null;
      private intervalId: number | null = null;
      private stopListeners: Array<() => void> = [];

      start(timeslice = 1000) {
        this.state = "recording";
        this.ondataavailable?.({
          data: new Blob(["audio"], { type: this.mimeType }),
        });
        this.intervalId = window.setInterval(() => {
          this.ondataavailable?.({
            data: new Blob(["audio"], { type: this.mimeType }),
          });
        }, timeslice);
      }

      stop() {
        this.state = "inactive";
        if (this.intervalId) {
          window.clearInterval(this.intervalId);
        }
        this.ondataavailable?.({
          data: new Blob(["final-audio"], { type: this.mimeType }),
        });
        this.stopListeners.forEach((listener) => listener());
      }

      addEventListener(type: string, listener: () => void) {
        if (type === "stop") {
          this.stopListeners.push(listener);
        }
      }
    }

    Object.defineProperty(window, "MediaRecorder", {
      configurable: true,
      writable: true,
      value: FakeMediaRecorder,
    });

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => ({
          getTracks: () => [{ stop: () => undefined }],
        }),
      },
    });
  });
});

test("records, refreshes suggestions, and opens chat from a suggestion", async ({ page }) => {
  await page.route("**/api/validate-key", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        supports: {
          transcription: true,
          suggestions: true,
        },
      }),
    });
  });

  await page.route("**/api/transcribe", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        chunk: {
          id: "transcript_1",
          text: "We are discussing backend scaling and websocket costs.",
          timestamp: "2026-04-16T12:00:00.000Z",
          startedAtMs: 0,
          endedAtMs: 30000,
          source: "mic",
        },
      }),
    });
  });

  await page.route("**/api/suggestions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        batch: {
          id: "batch_1",
          createdAt: "2026-04-16T12:00:30.000Z",
          refreshReason: "manual",
          suggestions: [
            {
              id: "s_1",
              kind: "question",
              preview: "Ask which shard key stays stable under spikes.",
              whyNow: "Sharding is the live topic.",
              quoteAnchor: "shard key",
            },
            {
              id: "s_2",
              kind: "answer",
              preview: "Managed Kafka at this volume can reach five figures monthly.",
              whyNow: "They asked about cost.",
              quoteAnchor: "monthly bill",
            },
            {
              id: "s_3",
              kind: "fact",
              preview: "Config rollout failures and capacity failures need different safeguards.",
              whyNow: "They referenced outages.",
              quoteAnchor: "avoid that pattern",
            },
          ],
        },
      }),
    });
  });

  await page.route("**/api/chat", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: [
        'data: {"choices":[{"delta":{"content":"Detailed answer for the clicked suggestion."}}]}',
        "",
        "data: [DONE]",
        "",
      ].join("\n"),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByPlaceholder("gsk_...").fill("gsk_test");
  await page.getByRole("button", { name: "Validate key" }).click();
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByTitle("Start / stop recording").click();
  await page.getByRole("button", { name: "↻ Reload suggestions" }).click();

  await expect(page.getByText("We are discussing backend scaling and websocket costs.")).toBeVisible();
  await expect(page.getByText("Ask which shard key stays stable under spikes.")).toBeVisible();

  await page.getByText("Ask which shard key stays stable under spikes.").click();
  await expect(page.getByText("Detailed answer for the clicked suggestion.")).toBeVisible();
});
