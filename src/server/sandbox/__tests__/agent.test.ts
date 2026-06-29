import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AIGenerateTextInput,
  AIGenerateTextResult,
  AIMessage,
  AIToolCall,
} from "~/server/ai/types";
import type { SandboxAgentInput, SandboxSession } from "~/server/sandbox/types";

const {
  generateTextMock,
  getSessionMock,
  listToolExecuteMock,
  readToolExecuteMock,
  runCommandMock,
  searchToolExecuteMock,
  writeToolExecuteMock,
} = vi.hoisted(() => ({
  generateTextMock: vi.fn<
    (input: AIGenerateTextInput) => Promise<AIGenerateTextResult>
  >(),
  getSessionMock: vi.fn(),
  listToolExecuteMock: vi.fn(),
  readToolExecuteMock: vi.fn(),
  runCommandMock: vi.fn(),
  searchToolExecuteMock: vi.fn(),
  writeToolExecuteMock: vi.fn(),
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

function buildToolDefinition(name: string, description: string) {
  return {
    function: {
      description,
      name,
      parameters: {
        additionalProperties: false,
        type: "object",
      },
    },
    type: "function" as const,
  };
}

vi.mock("~/server/sandbox/tools/model-tools", () => ({
  buildSandboxAgentModelTools: () => [
    buildToolDefinition("list_directory", "List files in a directory."),
    buildToolDefinition("read_file", "Read a file from the sandbox."),
    buildToolDefinition("search_code", "Search code in the sandbox."),
    buildToolDefinition("write_file", "Write a file in the sandbox."),
  ],
}));

function buildRegistryTool(
  id: string,
  description: string,
  execute: ReturnType<typeof vi.fn>,
) {
  return {
    description,
    execute,
    id,
    parameters: {
      additionalProperties: false,
      type: "object",
    },
  };
}

vi.mock("~/server/sandbox/tools/registry", () => ({
  getSandboxAgentTool: (name: string) => {
    switch (name) {
      case "list_directory":
        return buildRegistryTool(
          "list_directory",
          "List files in a directory.",
          listToolExecuteMock,
        );
      case "read_file":
        return buildRegistryTool(
          "read_file",
          "Read a file from the sandbox.",
          readToolExecuteMock,
        );
      case "search_code":
        return buildRegistryTool(
          "search_code",
          "Search code in the sandbox.",
          searchToolExecuteMock,
        );
      case "write_file":
        return buildRegistryTool(
          "write_file",
          "Write a file in the sandbox.",
          writeToolExecuteMock,
        );
      default:
        return undefined;
    }
  },
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
  name: string,
  args: Record<string, unknown>,
  id = `call-${name}`,
): AIToolCall {
  return {
    function: {
      arguments: JSON.stringify(args),
      name,
    },
    id,
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

function getFinalModelMessages() {
  const finalCall = generateTextMock.mock.calls.at(-1)?.[0];

  return (finalCall?.messages ?? []) as AIMessage[];
}

function getAssistantToolCallMessage(messages: AIMessage[]) {
  return messages.find(
    (message) => message.role === "assistant" && "tool_calls" in message,
  );
}

function getToolMessages(messages: AIMessage[]) {
  return messages.filter((message) => message.role === "tool");
}

beforeEach(() => {
  generateTextMock.mockReset();
  getSessionMock.mockReset();
  listToolExecuteMock.mockReset();
  readToolExecuteMock.mockReset();
  runCommandMock.mockReset();
  searchToolExecuteMock.mockReset();
  writeToolExecuteMock.mockReset();

  getSessionMock.mockResolvedValue(mockSession);
  runCommandMock.mockResolvedValue({
    command: "git diff -- .",
    exitCode: 0,
    stderr: "",
    stdout: "diff --git a/src/data/projects.js b/src/data/projects.js",
  });

  listToolExecuteMock.mockResolvedValue([
    {
      name: "ProjectsPage.jsx",
      path: "src/pages/ProjectsPage.jsx",
      type: "file",
    },
  ]);
  readToolExecuteMock.mockImplementation(async (args) => ({
    content: `content for ${String(args.path)}`,
    endLine: 4,
    path: String(args.path),
    size: 120,
    startLine: 1,
    totalLines: 4,
    truncated: false,
  }));
  searchToolExecuteMock.mockResolvedValue({
    caps: {
      perFile: 2,
      total: 10,
    },
    matches: [
      {
        column: 5,
        line: 10,
        path: "src/data/projects.js",
        text: "title: 'Tessera'",
      },
    ],
    truncated: false,
  });
  writeToolExecuteMock.mockResolvedValue({
    path: "src/data/projects.js",
    session: mockSession,
  });
});

describe("runSandboxAgent", () => {
  it("accepts a valid two-call read-only batch and appends both tool results", async () => {
    generateTextMock
      .mockResolvedValueOnce(
        createModelResponse({
          text: "I'll inspect the page and the data file.",
          toolCalls: [
            createToolCall("list_directory", { path: "src/pages" }, "call-list"),
            createToolCall("read_file", { path: "src/data/projects.js" }, "call-read"),
          ],
        }),
      )
      .mockResolvedValueOnce(
        createModelResponse({
          text: "Done inspecting.",
        }),
      )
      .mockResolvedValueOnce(
        createModelResponse({
          text: JSON.stringify({
            message: "Inspected the relevant files.",
            status: "completed",
          }),
        }),
      );

    const result = await runSandboxAgent(baseInput);
    const finalMessages = getFinalModelMessages();
    const assistantToolCallMessage = getAssistantToolCallMessage(finalMessages);
    const toolMessages = getToolMessages(finalMessages);

    expect(result).toMatchObject({
      filesTouched: ["src/data/projects.js"],
      message: "Inspected the relevant files.",
      status: "completed",
      stepsUsed: 3,
    });
    expect(listToolExecuteMock).toHaveBeenCalledTimes(1);
    expect(readToolExecuteMock).toHaveBeenCalledTimes(1);
    expect(assistantToolCallMessage).toMatchObject({
      content: "I'll inspect the page and the data file.",
      role: "assistant",
      tool_calls: [
        expect.objectContaining({ id: "call-list" }),
        expect.objectContaining({ id: "call-read" }),
      ],
    });
    expect(toolMessages).toHaveLength(2);
    expect(toolMessages[0]).toMatchObject({
      role: "tool",
      tool_call_id: "call-list",
    });
    expect(toolMessages[1]).toMatchObject({
      role: "tool",
      tool_call_id: "call-read",
    });
  });

  it("accepts up to five read-only tool calls in one turn", async () => {
    generateTextMock
      .mockResolvedValueOnce(
        createModelResponse({
          text: "I'll inspect all the relevant files first.",
          toolCalls: [
            createToolCall("list_directory", { path: "src/pages" }, "call-1"),
            createToolCall("read_file", { path: "src/pages/ProjectsPage.jsx" }, "call-2"),
            createToolCall("read_file", { path: "src/data/projects.js" }, "call-3"),
            createToolCall("search_code", { path: "src", query: "healsync" }, "call-4"),
            createToolCall("search_code", { path: "src", query: "tessera" }, "call-5"),
          ],
        }),
      )
      .mockResolvedValueOnce(
        createModelResponse({
          text: "Done inspecting.",
        }),
      )
      .mockResolvedValueOnce(
        createModelResponse({
          text: JSON.stringify({
            message: "Checked the relevant files and search results.",
            status: "completed",
          }),
        }),
      );

    const result = await runSandboxAgent(baseInput);
    const finalMessages = getFinalModelMessages();

    expect(result).toMatchObject({
      filesTouched: ["src/data/projects.js", "src/pages/ProjectsPage.jsx"],
      message: "Checked the relevant files and search results.",
      status: "completed",
      stepsUsed: 3,
    });
    expect(listToolExecuteMock).toHaveBeenCalledTimes(1);
    expect(readToolExecuteMock).toHaveBeenCalledTimes(2);
    expect(searchToolExecuteMock).toHaveBeenCalledTimes(2);
    expect(getAssistantToolCallMessage(finalMessages)).toMatchObject({
      role: "assistant",
      tool_calls: [
        expect.objectContaining({ id: "call-1" }),
        expect.objectContaining({ id: "call-2" }),
        expect.objectContaining({ id: "call-3" }),
        expect.objectContaining({ id: "call-4" }),
        expect.objectContaining({ id: "call-5" }),
      ],
    });
    expect(getToolMessages(finalMessages)).toHaveLength(5);
  });

  it("retries once when more than five read-only tool calls are returned", async () => {
    generateTextMock
      .mockResolvedValueOnce(
        createModelResponse({
          text: "I'll inspect every likely file.",
          toolCalls: [
            createToolCall("read_file", { path: "src/a.ts" }, "call-1"),
            createToolCall("read_file", { path: "src/b.ts" }, "call-2"),
            createToolCall("read_file", { path: "src/c.ts" }, "call-3"),
            createToolCall("read_file", { path: "src/d.ts" }, "call-4"),
            createToolCall("read_file", { path: "src/e.ts" }, "call-5"),
            createToolCall("read_file", { path: "src/f.ts" }, "call-6"),
          ],
        }),
      )
      .mockResolvedValueOnce(
        createModelResponse({
          text: "I'll inspect every likely file again.",
          toolCalls: [
            createToolCall("read_file", { path: "src/a.ts" }, "call-retry-1"),
            createToolCall("read_file", { path: "src/b.ts" }, "call-retry-2"),
            createToolCall("read_file", { path: "src/c.ts" }, "call-retry-3"),
            createToolCall("read_file", { path: "src/d.ts" }, "call-retry-4"),
            createToolCall("read_file", { path: "src/e.ts" }, "call-retry-5"),
            createToolCall("read_file", { path: "src/f.ts" }, "call-retry-6"),
          ],
        }),
      );

    const result = await runSandboxAgent(baseInput);
    const retryMessages = getFinalModelMessages();

    expect(result).toMatchObject({
      filesTouched: [],
      message: "The agent returned an invalid tool batch and could not recover.",
      status: "failed",
      stepsUsed: 2,
    });
    expect(readToolExecuteMock).not.toHaveBeenCalled();
    expect(
      retryMessages.some(
        (message) =>
          message.role === "user" &&
          message.content.includes("up to 5 read-only tool calls"),
      ),
    ).toBe(true);
  });

  it("rejects write_file when mixed with read-only tools", async () => {
    generateTextMock
      .mockResolvedValueOnce(
        createModelResponse({
          text: "I'll read and write in the same turn.",
          toolCalls: [
            createToolCall("read_file", { path: "src/data/projects.js" }, "call-read"),
            createToolCall(
              "write_file",
              {
                content: "export const projects = [];",
                path: "src/data/projects.js",
              },
              "call-write",
            ),
          ],
        }),
      )
      .mockResolvedValueOnce(
        createModelResponse({
          text: "I'll read and write in the same turn again.",
          toolCalls: [
            createToolCall("read_file", { path: "src/data/projects.js" }, "call-read-retry"),
            createToolCall(
              "write_file",
              {
                content: "export const projects = [];",
                path: "src/data/projects.js",
              },
              "call-write-retry",
            ),
          ],
        }),
      );

    const result = await runSandboxAgent(baseInput);

    expect(result).toMatchObject({
      filesTouched: [],
      message: "The agent returned an invalid tool batch and could not recover.",
      status: "failed",
      stepsUsed: 2,
    });
    expect(readToolExecuteMock).not.toHaveBeenCalled();
    expect(writeToolExecuteMock).not.toHaveBeenCalled();
  });

  it("runs all read-only calls in a batch even when one returns a recoverable failure", async () => {
    readToolExecuteMock
      .mockResolvedValueOnce({
        content: "content for src/a.ts",
        endLine: 4,
        path: "src/a.ts",
        size: 120,
        startLine: 1,
        totalLines: 4,
        truncated: false,
      })
      .mockRejectedValueOnce(new Error("missing_path"))
      .mockResolvedValueOnce({
        content: "content for src/c.ts",
        endLine: 4,
        path: "src/c.ts",
        size: 120,
        startLine: 1,
        totalLines: 4,
        truncated: false,
      });

    generateTextMock
      .mockResolvedValueOnce(
        createModelResponse({
          text: "I'll inspect the likely files first.",
          toolCalls: [
            createToolCall("read_file", { path: "src/a.ts" }, "call-a"),
            createToolCall("read_file", { path: "src/b.ts" }, "call-b"),
            createToolCall("read_file", { path: "src/c.ts" }, "call-c"),
          ],
        }),
      )
      .mockResolvedValueOnce(
        createModelResponse({
          text: "Done inspecting.",
        }),
      )
      .mockResolvedValueOnce(
        createModelResponse({
          text: JSON.stringify({
            message: "Finished inspecting despite one missing file.",
            status: "completed",
          }),
        }),
      );

    const result = await runSandboxAgent(baseInput);
    const finalToolMessages = getToolMessages(getFinalModelMessages());

    expect(result).toMatchObject({
      filesTouched: ["src/a.ts", "src/c.ts"],
      message: "Finished inspecting despite one missing file.",
      status: "completed",
      stepsUsed: 3,
    });
    expect(readToolExecuteMock).toHaveBeenCalledTimes(3);
    expect(finalToolMessages).toHaveLength(3);
    expect(finalToolMessages[1]).toMatchObject({
      role: "tool",
      tool_call_id: "call-b",
    });
    expect((finalToolMessages[1] as { content: string }).content).toContain(
      "\"ok\":false",
    );
  });

  it("stops a read-only batch immediately on a hard failure", async () => {
    readToolExecuteMock
      .mockResolvedValueOnce({
        content: "content for src/a.ts",
        endLine: 4,
        path: "src/a.ts",
        size: 120,
        startLine: 1,
        totalLines: 4,
        truncated: false,
      })
      .mockRejectedValueOnce(new Error("Sandbox is not running."));

    generateTextMock.mockResolvedValueOnce(
      createModelResponse({
        text: "I'll inspect the likely files first.",
        toolCalls: [
          createToolCall("read_file", { path: "src/a.ts" }, "call-a"),
          createToolCall("read_file", { path: "src/b.ts" }, "call-b"),
          createToolCall("read_file", { path: "src/c.ts" }, "call-c"),
        ],
      }),
    );

    const result = await runSandboxAgent(baseInput);

    expect(result).toMatchObject({
      filesTouched: ["src/a.ts"],
      message: "The sandbox is not running.",
      status: "failed",
      stepsUsed: 1,
    });
    expect(readToolExecuteMock).toHaveBeenCalledTimes(2);
  });

  it("keeps write_file as a single-call turn", async () => {
    generateTextMock
      .mockResolvedValueOnce(
        createModelResponse({
          text: "I'll update the projects data now.",
          toolCalls: [
            createToolCall(
              "write_file",
              {
                content: "export const projects = [];",
                path: "src/data/projects.js",
              },
              "call-write",
            ),
          ],
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
    expect(writeToolExecuteMock).toHaveBeenCalledWith(
      {
        content: "export const projects = [];",
        path: "src/data/projects.js",
      },
      {
        sessionId: "session-test",
      },
    );
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
  });
});
