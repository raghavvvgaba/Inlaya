import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/env", () => ({
  env: {
    GITHUB_APP_CALLBACK_URL: "https://example.com/api/github/callback",
    OPENROUTER_API_KEY: "openrouter-test-key",
    OPENROUTER_MODEL: "deepseek-v4-flash",
  },
}));

import { openRouterAiProvider } from "../openrouter";

function response(message: Record<string, unknown>, reasoningTokens = 0) {
  return new Response(
    JSON.stringify({
      choices: [{ message }],
      model: "deepseek/deepseek-v4-flash",
      usage: {
        completion_tokens: 8,
        completion_tokens_details: { reasoning_tokens: reasoningTokens },
        prompt_tokens: 20,
        total_tokens: 28,
      },
    }),
    { status: 200 },
  );
}

describe("OpenRouter reasoning continuity", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefers structured reasoning details and keeps usage counts separate", async () => {
    const reasoningDetails = [
      {
        format: "openrouter-test-v1",
        id: "reasoning-1",
        text: "Inspect the relevant file first.",
        type: "reasoning.text",
      },
    ];
    vi.mocked(fetch).mockResolvedValueOnce(
      response(
        {
          content: "I'll inspect the file.",
          reasoning: "plaintext fallback",
          reasoning_details: reasoningDetails,
          tool_calls: [
            {
              function: {
                arguments: '{"path":"src/file.ts"}',
                name: "read_file",
              },
              id: "call-read",
              type: "function",
            },
          ],
        },
        6,
      ),
    );

    await expect(
      openRouterAiProvider.generateText({
        messages: [{ content: "Inspect the file.", role: "user" }],
        model: "deepseek-v4-flash",
      }),
    ).resolves.toMatchObject({
      reasoning: { details: reasoningDetails, type: "details" },
      usage: { reasoningTokens: 6 },
    });
  });

  it("falls back to plaintext reasoning when details are absent", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      response({ content: "Done.", reasoning: "The task is complete." }),
    );

    await expect(
      openRouterAiProvider.generateText({
        messages: [{ content: "Continue.", role: "user" }],
      }),
    ).resolves.toMatchObject({
      reasoning: { text: "The task is complete.", type: "text" },
    });
  });

  it("forwards preserved reasoning fields without modifying them", async () => {
    const reasoningDetails = [
      {
        data: "opaque-provider-state",
        format: "openrouter-test-v1",
        id: "reasoning-2",
        type: "reasoning.encrypted",
      },
    ];
    vi.mocked(fetch).mockResolvedValueOnce(response({ content: "Done." }));

    await openRouterAiProvider.generateText({
      messages: [
        { content: "Inspect the file.", role: "user" },
        {
          content: "",
          reasoning_details: reasoningDetails,
          role: "assistant",
          tool_calls: [
            {
              function: {
                arguments: '{"path":"src/file.ts"}',
                name: "read_file",
              },
              id: "call-read",
              type: "function",
            },
          ],
        },
        {
          content: '{"content":"export const value = 1;"}',
          role: "tool",
          tool_call_id: "call-read",
        },
      ],
    });

    const request = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body)) as {
      messages: Array<Record<string, unknown>>;
    };
    expect(body.messages[1]?.reasoning_details).toEqual(reasoningDetails);
    expect(body.messages[1]?.reasoning).toBeUndefined();
  });
});
