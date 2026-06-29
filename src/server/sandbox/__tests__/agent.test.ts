import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AIGenerateTextInput, AIGenerateTextResult, AIToolCall } from "~/server/ai/types";
import type { SandboxAgentInput, SandboxSession } from "~/server/sandbox/types";

const {
  generateTextMock,
  getSessionMock,
  runCommandMock,
  toolExecuteMock,
} = vi.hoisted(() => ({
  generateTextMock: vi.fn<
    (input: AIGenerateTextInput) => Promise<AIGenerateTextResult>
  >(),
  getSessionMock: vi.fn(),
  runCommandMock: vi.fn(),
  toolExecuteMock: vi.fn(),
}));

vi.mock("~/server/ai/provider", () => ({
  aiProvider: {
    generateText: generateTextMock,
  },
}));

vi.mock("~/server/sandbox/provider", () => ({
  sandboxProvider: {
    get: getSessionMock,
    runCommand: runCommandMock,
  },
}));

vi.mock("~/server/sandbox/tools/model-tools", () => ({
  buildSandboxAgentModelTools: () => [
    {
      function: {
        description: "Write a file in the sandbox.",
        name: "write_file",
        parameters: {
          additionalProperties: false,
          properties: {
            content: {
              type: "string",
            },
            path: {
              type: "string",
            },
          },
          required: ["path", "content"],
          type: "object",
        },
      },
      type: "function" as const,
    },
  ],
}));

vi.mock("~/server/sandbox/tools/registry", () => ({
  getSandboxAgentTool: (name: string) =>
    name === "write_file"
      ? {
          description: "Write a file in the sandbox.",
          execute: toolExecuteMock,
          id: "write_file",
          parameters: {
            additionalProperties: false,
            properties: {
              content: {
                type: "string",
              },
              path: {
                type: "string",
              },
            },
            required: ["path", "content"],
            type: "object",
          },
        }
      : undefined,
}));

import { runSandboxAgent } from "../agent";

const mockSession: SandboxSession = {
  environmentId: "env-test",
  logs: [],
  previewState: "ready",
  previewUrl: "https://preview.test",
  sessionId: "session-test",
  status: "running",
};

const baseInput: SandboxAgentInput = {
  issueNumber: 16,
  issueTitle: "Replace HealSync with Tessera",
  projectId: "project-test",
  repoName: "Portfolio",
  repoOwner: "raghavvvgaba",
  sessionId: "session-test",
  userInstruction: "Replace HealSync with Tessera on the projects page.",
};

function createToolCall(
  overrides: Partial<AIToolCall["function"]> = {},
): AIToolCall {
  return {
    function: {
      arguments: JSON.stringify({
        content: "export const projects = [];",
        path: "src/data/projects.js",
      }),
      name: "write_file",
      ...overrides,
    },
    id: "call-write-file",
    type: "function",
  };
}

function createModelResponse(
  overrides: Partial<AIGenerateTextResult> = {},
): AIGenerateTextResult {
  return {
    model: "test-model",
    text: "",
    ...overrides,
  };
}

beforeEach(() => {
  generateTextMock.mockReset();
  getSessionMock.mockReset();
  runCommandMock.mockReset();
  toolExecuteMock.mockReset();

  getSessionMock.mockResolvedValue(mockSession);
  runCommandMock.mockResolvedValue({
    command: "git diff -- .",
    exitCode: 0,
    stderr: "",
    stdout: "diff --git a/src/data/projects.js b/src/data/projects.js",
  });
  toolExecuteMock.mockResolvedValue({
    path: "src/data/projects.js",
    session: mockSession,
  });
});

describe("runSandboxAgent", () => {
  it("uses a dedicated finish turn after tool turns", async () => {
    generateTextMock
      .mockResolvedValueOnce(
        createModelResponse({
          text: "I'll update the projects data now.",
          toolCalls: [createToolCall()],
        }),
      )
      .mockResolvedValueOnce(
        createModelResponse({
          text: "Done. I updated the projects data.",
        }),
      )
      .mockResolvedValueOnce(
        createModelResponse({
          text: JSON.stringify({
            message: "Updated the projects data.",
            status: "completed",
          }),
        }),
      );

    const result = await runSandboxAgent(baseInput);

    expect(result).toMatchObject({
      diff: "diff --git a/src/data/projects.js b/src/data/projects.js",
      filesTouched: ["src/data/projects.js"],
      message: "Updated the projects data.",
      session: mockSession,
      status: "completed",
      stepsUsed: 3,
    });

    expect(toolExecuteMock).toHaveBeenCalledWith(
      {
        content: "export const projects = [];",
        path: "src/data/projects.js",
      },
      {
        sessionId: "session-test",
      },
    );

    expect(generateTextMock).toHaveBeenCalledTimes(3);
    expect(generateTextMock.mock.calls[0]?.[0]).toMatchObject({
      toolChoice: "auto",
      tools: [
        expect.objectContaining({
          function: expect.objectContaining({
            name: "write_file",
          }),
        }),
      ],
    });
    expect(generateTextMock.mock.calls[0]?.[0]).not.toHaveProperty(
      "responseFormat",
    );
    expect(generateTextMock.mock.calls[1]?.[0]).toMatchObject({
      toolChoice: "auto",
    });
    expect(generateTextMock.mock.calls[1]?.[0]).not.toHaveProperty(
      "responseFormat",
    );
    expect(generateTextMock.mock.calls[2]?.[0]).toMatchObject({
      responseFormat: {
        jsonSchema: expect.objectContaining({
          name: "sandbox_agent_finish",
          strict: true,
        }),
        type: "json_schema",
      },
      toolChoice: "none",
    });
    expect(generateTextMock.mock.calls[2]?.[0]).not.toHaveProperty("tools");
  });

  it("can finalize immediately when the first tool turn has no tool calls", async () => {
    generateTextMock
      .mockResolvedValueOnce(
        createModelResponse({
          text: "",
        }),
      )
      .mockResolvedValueOnce(
        createModelResponse({
          text: JSON.stringify({
            message: "Nothing needed to change.",
            status: "completed",
          }),
        }),
      );

    const result = await runSandboxAgent(baseInput);

    expect(result).toMatchObject({
      filesTouched: [],
      message: "Nothing needed to change.",
      session: mockSession,
      status: "completed",
      stepsUsed: 2,
    });
    expect(toolExecuteMock).not.toHaveBeenCalled();
    expect(generateTextMock).toHaveBeenCalledTimes(2);
  });

  it("fails when the dedicated finish turn still returns invalid JSON", async () => {
    generateTextMock
      .mockResolvedValueOnce(
        createModelResponse({
          text: "Done. I removed the HealSync entry.",
        }),
      )
      .mockResolvedValueOnce(
        createModelResponse({
          text: "Done. HealSync was removed.",
        }),
      );

    const result = await runSandboxAgent(baseInput);

    expect(result).toMatchObject({
      diff: "diff --git a/src/data/projects.js b/src/data/projects.js",
      filesTouched: [],
      message: "The agent returned an invalid completion response.",
      session: mockSession,
      status: "failed",
      stepsUsed: 2,
    });
    expect(generateTextMock).toHaveBeenCalledTimes(2);
  });

  it("does not parse a natural-language no-tool turn as the final answer", async () => {
    generateTextMock
      .mockResolvedValueOnce(
        createModelResponse({
          text: "Done. I replaced HealSync with Tessera in the projects data.",
        }),
      )
      .mockResolvedValueOnce(
        createModelResponse({
          text: JSON.stringify({
            message: "Replaced HealSync with Tessera in the projects data.",
            status: "completed",
          }),
        }),
      );

    const result = await runSandboxAgent(baseInput);

    expect(result).toMatchObject({
      message: "Replaced HealSync with Tessera in the projects data.",
      status: "completed",
      stepsUsed: 2,
    });
    expect(generateTextMock).toHaveBeenCalledTimes(2);
    expect(generateTextMock.mock.calls[1]?.[0].messages.at(-2)).toMatchObject({
      content: "Done. I replaced HealSync with Tessera in the projects data.",
      role: "assistant",
    });
  });
});
