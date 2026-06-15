import "server-only";

import { z } from "zod";

import type {
  AIMessage,
  AIToolCall,
  AIGenerateTextResult,
} from "~/server/ai/types";
import { aiProvider } from "~/server/ai/provider";
import {
  buildSandboxAgentModelTools,
} from "~/server/sandbox/tools/model-tools";
import {
  getSandboxAgentTool,
  type SandboxAgentToolName,
} from "~/server/sandbox/tools/registry";
import { sandboxProvider } from "~/server/sandbox/provider";
import { getSandboxDiff } from "~/server/sandbox/tools/diff";
import type {
  SandboxAgentInput,
  SandboxAgentResult,
  SandboxFile,
  SandboxFileEntry,
  SandboxSearchResult,
  SandboxSession,
} from "~/server/sandbox/types";

const MAX_AGENT_STEPS = 8;
const MAX_RECENT_EVENTS = 5;
const MAX_LIST_DIRECTORY_ENTRIES = 40;

const sandboxAgentModelTools = buildSandboxAgentModelTools();
const sandboxAgentToolIds = sandboxAgentModelTools.map(
  (tool) => tool.function.name,
) as SandboxAgentToolName[];

const finishSchema = z.object({
  clarificationQuestion: z.string().trim().min(1).max(240).optional(),
  message: z.string().trim().min(1).max(400),
  status: z.enum(["completed", "blocked"]),
});

type AgentFailureCode =
  | "internal_error"
  | "model_rate_limited"
  | "model_unavailable"
  | "sandbox_not_running"
  | "tool_retry_exhausted";

type SandboxAgentInternalResult =
  | ({
      failureCode?: undefined;
    } & SandboxAgentResult)
  | ({
      failureCode: AgentFailureCode;
    } & SandboxAgentResult & { status: "failed" });

type AgentRunState = {
  filesTouched: Set<string>;
  latestObservation: string;
  latestSession?: SandboxSession;
  recentEvents: string[];
  recoverableToolErrorCount: number;
  stepsUsed: number;
  transcript: AIMessage[];
};

type AgentToolSuccess = {
  latestObservation: string;
  recentEvent: string;
  session?: SandboxSession;
  toolMessageContent: string;
  touchedPath?: string;
};

type AgentToolRecoverableFailure = {
  latestObservation: string;
  recentEvent: string;
  status: "recoverable_failure";
  toolMessageContent: string;
};

type AgentToolHardFailure = {
  code: AgentFailureCode;
  message: string;
  recentEvent: string;
  status: "hard_failure";
};

type AgentToolExecutionResult =
  | ({ status: "ok" } & AgentToolSuccess)
  | AgentToolRecoverableFailure
  | AgentToolHardFailure;

function pushRecentEvent(state: AgentRunState, event: string) {
  state.recentEvents.push(event);

  if (state.recentEvents.length > MAX_RECENT_EVENTS) {
    state.recentEvents.shift();
  }
}

function buildAgentSystemPrompt() {
  return [
    "You are Devin's bounded coding agent for one sandbox repository.",
    `You have at most ${MAX_AGENT_STEPS} turns to finish.`,
    "Respond in English.",
    "Use at most one tool call per turn.",
    "Search or inspect before editing when the target is unclear.",
    "Prefer bounded reads first.",
    "Request a full-file read only immediately before writing that file.",
    "Only write files you have already inspected.",
    "If the request is unclear or unsupported, answer with JSON containing status, message, and an optional clarificationQuestion.",
    "Do not invent tools, files, commands, or multi-action turns.",
  ].join("\n");
}

function buildAgentUserPrompt(input: SandboxAgentInput) {
  return [
    `Repository: ${input.repoOwner}/${input.repoName}`,
    `Project id: ${input.projectId}`,
    `Issue #${input.issueNumber}: ${input.issueTitle}`,
    "",
    "User instruction:",
    input.userInstruction,
    "",
    "When you are done or blocked, return JSON with:",
    '- "status": "completed" or "blocked"',
    '- "message": short user-facing explanation',
    '- "clarificationQuestion": optional follow-up question when blocked',
  ].join("\n");
}

function formatSearchResult(result: SandboxSearchResult) {
  if (result.matches.length === 0) {
    return [
      "search_code returned no matches.",
      `truncated: ${result.truncated ? "true" : "false"}`,
    ].join("\n");
  }

  return [
    "search_code matches:",
    ...result.matches.map(
      (match) =>
        `- ${match.path}:${match.line}:${match.column} ${match.text}`,
    ),
    `truncated: ${result.truncated ? "true" : "false"}`,
  ].join("\n");
}

function formatDirectoryEntries(entries: SandboxFileEntry[]) {
  const visibleEntries = entries.slice(0, MAX_LIST_DIRECTORY_ENTRIES);

  return [
    "list_directory entries:",
    ...visibleEntries.map((entry) => `- [${entry.type}] ${entry.path}`),
    ...(entries.length > visibleEntries.length
      ? [`- ...and ${entries.length - visibleEntries.length} more entries.`]
      : []),
  ].join("\n");
}

function formatReadFileResult(file: SandboxFile) {
  return [
    `read_file path: ${file.path}`,
    `lines: ${file.startLine}-${file.endLine} of ${file.totalLines}`,
    `truncated: ${file.truncated ? "true" : "false"}`,
    "content:",
    "```",
    file.content,
    "```",
  ].join("\n");
}

function normalizeToolErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return "unknown_tool_error";
}

function isRecoverableToolError(message: string) {
  return (
    message === "file_too_large" ||
    message === "invalid_tool_arguments_json" ||
    message === "invalid_line_range" ||
    message === "invalid_path" ||
    message === "missing_path" ||
    message === "missing_query" ||
    message.includes("ENOENT") ||
    message.includes("No such file") ||
    message.includes("not found")
  );
}

function mapHardToolFailure(message: string): AgentToolHardFailure {
  if (message === "Sandbox is not running.") {
    return {
      code: "sandbox_not_running",
      message: "The sandbox is not running.",
      recentEvent: "A tool failed because the sandbox is not running.",
      status: "hard_failure",
    };
  }

  return {
    code: "internal_error",
    message: "The agent could not continue because a sandbox tool failed.",
    recentEvent: `A tool failed unexpectedly: ${message}`,
    status: "hard_failure",
  };
}

function mapModelError(error: unknown): {
  code: AgentFailureCode;
  message: string;
} {
  const message = error instanceof Error ? error.message : "";

  if (
    message.includes("OPENROUTER_API_KEY") ||
    message.includes("authentication failed") ||
    message.includes("model is not configured")
  ) {
    return {
      code: "model_unavailable",
      message: "The AI model is not available right now.",
    };
  }

  if (message.includes("rate limited")) {
    return {
      code: "model_rate_limited",
      message: "The AI model is rate limited right now. Please try again.",
    };
  }

  return {
    code: "internal_error",
    message: "The agent could not continue because the model request failed.",
  };
}

function isSandboxAgentToolName(value: string): value is SandboxAgentToolName {
  return sandboxAgentToolIds.includes(value as SandboxAgentToolName);
}

function formatToolFeedback(tool: SandboxAgentToolName, message: string) {
  return [
    `The previous ${tool} call failed.`,
    `Error: ${message}`,
    "Fix the tool arguments or choose a different next step.",
  ].join("\n");
}

function buildFinishResponseSchema() {
  return {
    additionalProperties: false,
    properties: {
      clarificationQuestion: {
        maxLength: 240,
        minLength: 1,
        type: "string",
      },
      message: {
        maxLength: 400,
        minLength: 1,
        type: "string",
      },
      status: {
        enum: ["completed", "blocked"],
      },
    },
    required: ["status", "message"],
    type: "object",
  } as const;
}

function parseFinishResponse(text: string) {
  return finishSchema.parse(JSON.parse(text));
}

async function callAgentModel(
  state: AgentRunState,
): Promise<AIGenerateTextResult> {
  return aiProvider.generateText({
    maxTokens: 1_500,
    messages: state.transcript,
    responseFormat: {
      type: "json_schema",
      jsonSchema: {
        name: "sandbox_agent_finish",
        schema: buildFinishResponseSchema(),
        strict: true,
      },
    },
    temperature: 0.1,
    toolChoice: "auto",
    tools: sandboxAgentModelTools,
  });
}

async function executeToolCall(
  toolCall: AIToolCall,
  sessionId: string,
): Promise<AgentToolExecutionResult> {
  if (!isSandboxAgentToolName(toolCall.function.name)) {
    return {
      code: "internal_error",
      message: "The agent could not continue because a sandbox tool was missing.",
      recentEvent: `A tool was requested but not found: ${toolCall.function.name}`,
      status: "hard_failure",
    };
  }

  const toolName = toolCall.function.name;
  const tool = getSandboxAgentTool(toolName);

  if (!tool) {
    return {
      code: "internal_error",
      message: "The agent could not continue because a sandbox tool was missing.",
      recentEvent: `A tool was requested but not found: ${toolName}`,
      status: "hard_failure",
    };
  }

  try {
    const parsedArguments = JSON.parse(toolCall.function.arguments) as Record<
      string,
      unknown
    >;
    const result = await tool.execute(parsedArguments, {
      sessionId,
    });
    const toolMessageContent = JSON.stringify(result);

    switch (toolName) {
      case "list_directory":
        return {
          latestObservation: formatDirectoryEntries(result as SandboxFileEntry[]),
          recentEvent: `Listed ${typeof parsedArguments.path === "string" && parsedArguments.path ? parsedArguments.path : "."}.`,
          status: "ok",
          toolMessageContent,
        };
      case "read_file": {
        const file = result as SandboxFile;

        return {
          latestObservation: formatReadFileResult(file),
          recentEvent: `Read ${file.path} lines ${file.startLine}-${file.endLine}.`,
          status: "ok",
          toolMessageContent,
          touchedPath: file.path,
        };
      }
      case "search_code":
        return {
          latestObservation: formatSearchResult(result as SandboxSearchResult),
          recentEvent: `Searched for ${JSON.stringify(typeof parsedArguments.query === "string" ? parsedArguments.query : "")}${typeof parsedArguments.path === "string" && parsedArguments.path ? ` in ${parsedArguments.path}` : ""}.`,
          status: "ok",
          toolMessageContent,
        };
      case "write_file": {
        const writeResult = result as {
          path: string;
          session: SandboxSession;
        };

        return {
          latestObservation: `write_file updated ${writeResult.path}.`,
          recentEvent: `Wrote ${writeResult.path}.`,
          session: writeResult.session,
          status: "ok",
          toolMessageContent,
          touchedPath: writeResult.path,
        };
      }
    }

    return {
      code: "internal_error",
      message: "The agent could not continue because a sandbox tool was not handled.",
      recentEvent: `A tool completed but had no formatter: ${toolName}`,
      status: "hard_failure",
    };
  } catch (error) {
    const message =
      error instanceof SyntaxError
        ? "invalid_tool_arguments_json"
        : normalizeToolErrorMessage(error);

    if (isRecoverableToolError(message)) {
      return {
        latestObservation: formatToolFeedback(toolName, message),
        recentEvent: `${toolName} failed with a recoverable error: ${message}.`,
        status: "recoverable_failure",
        toolMessageContent: JSON.stringify({
          error: message,
          ok: false,
        }),
      };
    }

    return mapHardToolFailure(message);
  }
}

async function resolveFinalSession(
  state: AgentRunState,
  sessionId: string,
): Promise<SandboxSession | undefined> {
  if (state.latestSession) {
    return state.latestSession;
  }

  try {
    return (await sandboxProvider.get(sessionId)) ?? undefined;
  } catch {
    return undefined;
  }
}

async function resolveFinalDiff(sessionId: string) {
  try {
    return await getSandboxDiff({ sessionId });
  } catch {
    return "";
  }
}

function appendToolMessages(
  state: AgentRunState,
  toolCall: AIToolCall,
  toolMessageContent: string,
  assistantContent: string,
) {
  state.transcript.push({
    content: assistantContent,
    role: "assistant",
    tool_calls: [toolCall],
  });
  state.transcript.push({
    content: toolMessageContent,
    role: "tool",
    tool_call_id: toolCall.id,
  });
}

async function buildAgentResult(
  input: SandboxAgentInput,
  state: AgentRunState,
  result: Omit<SandboxAgentResult, "diff" | "filesTouched" | "session" | "stepsUsed">,
): Promise<SandboxAgentInternalResult> {
  return {
    ...result,
    diff: await resolveFinalDiff(input.sessionId),
    filesTouched: Array.from(state.filesTouched).sort(),
    session: await resolveFinalSession(state, input.sessionId),
    stepsUsed: state.stepsUsed,
  };
}

async function buildFailedResult(
  input: SandboxAgentInput,
  state: AgentRunState,
  failureCode: AgentFailureCode,
  message: string,
): Promise<SandboxAgentInternalResult> {
  return {
    diff: await resolveFinalDiff(input.sessionId),
    failureCode,
    filesTouched: Array.from(state.filesTouched).sort(),
    message,
    session: await resolveFinalSession(state, input.sessionId),
    status: "failed",
    stepsUsed: state.stepsUsed,
  };
}

export async function runSandboxAgent(
  input: SandboxAgentInput,
): Promise<SandboxAgentInternalResult> {
  const state: AgentRunState = {
    filesTouched: new Set<string>(),
    latestObservation: "No tool has been called yet.",
    recentEvents: [],
    recoverableToolErrorCount: 0,
    stepsUsed: 0,
    transcript: [
      {
        content: buildAgentSystemPrompt(),
        role: "system",
      },
      {
        content: buildAgentUserPrompt(input),
        role: "user",
      },
    ],
  };

  for (let step = 0; step < MAX_AGENT_STEPS; step += 1) {
    let modelResponse: AIGenerateTextResult;

    try {
      modelResponse = await callAgentModel(state);
    } catch (error) {
      console.error("Sandbox agent model turn failed:", error);
      const mappedError = mapModelError(error);

      return buildFailedResult(input, state, mappedError.code, mappedError.message);
    }

    state.stepsUsed += 1;

    const toolCall = modelResponse.toolCalls?.[0];

    if (!toolCall) {
      let finishResponse: z.infer<typeof finishSchema>;

      try {
        finishResponse = parseFinishResponse(modelResponse.text);
      } catch (error) {
        console.error("Sandbox agent finish response was invalid:", error);
        return buildFailedResult(
          input,
          state,
          "internal_error",
          "The agent returned an invalid completion response.",
        );
      }

      return buildAgentResult(input, state, {
        clarificationQuestion: finishResponse.clarificationQuestion,
        message: finishResponse.message,
        status: finishResponse.status,
      });
    }

    const toolResult = await executeToolCall(toolCall, input.sessionId);

    pushRecentEvent(state, toolResult.recentEvent);

    if (toolResult.status === "hard_failure") {
      return buildFailedResult(input, state, toolResult.code, toolResult.message);
    }

    appendToolMessages(
      state,
      toolCall,
      toolResult.toolMessageContent,
      modelResponse.text,
    );
    state.latestObservation = toolResult.latestObservation;

    if (toolResult.status === "recoverable_failure") {
      state.recoverableToolErrorCount += 1;

      if (state.recoverableToolErrorCount > 1) {
        return buildFailedResult(
          input,
          state,
          "tool_retry_exhausted",
          "The agent could not recover from a repeated tool error.",
        );
      }

      continue;
    }

    state.recoverableToolErrorCount = 0;

    if (toolResult.touchedPath) {
      state.filesTouched.add(toolResult.touchedPath);
    }

    if (toolResult.session) {
      state.latestSession = toolResult.session;
    }
  }

  return buildAgentResult(input, state, {
    message: "The agent reached its step limit before finishing.",
    status: "max_steps_reached",
  });
}
