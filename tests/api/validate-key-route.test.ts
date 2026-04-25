import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/validate-key/route";

describe("/api/validate-key", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns model availability on success", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ id: "whisper-large-v3" }, { id: "openai/gpt-oss-120b" }],
        }),
        { status: 200 },
      ),
    );

    const response = await POST(
      new Request("http://localhost/api/validate-key", {
        method: "POST",
        body: JSON.stringify({ apiKey: "gsk_test" }),
      }),
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.supports.transcription).toBe(true);
    expect(body.supports.suggestions).toBe(true);
  });

  it("surfaces upstream errors", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { message: "Invalid API key" },
        }),
        { status: 401 },
      ),
    );

    const response = await POST(
      new Request("http://localhost/api/validate-key", {
        method: "POST",
        body: JSON.stringify({ apiKey: "bad-key" }),
      }),
    );

    const body = await response.json();
    expect(response.status).toBe(401);
    expect(body.error).toContain("Invalid API key");
  });
});
