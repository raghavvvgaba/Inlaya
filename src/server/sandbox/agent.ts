import "server-only";

import { z } from "zod";

import type {
  AIUsage,
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
const MAX_READ_ONLY_TOOL_CALLS = 5;

const sandboxAgentModelTools = buildSandboxAgentModelTools();
const sandboxAgentToolIds = sandboxAgentModelTools.map(
  (tool) => tool.function.name,
) as SandboxAgentToolName[];
const READ_ONLY_TOOL_NAMES = new Set<SandboxAgentToolName>([
  "list_directory",
  "read_file",
  "search_code",
]);

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
  usage?: AIUsage;
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

type AgentModelPhase = "tool" | "finish";

type ToolTurnClassification =
  | {
      status: "finish";
    }
  | {
      status: "single";
      toolCalls: [AIToolCall];
    }
  | {
      status: "read_only_batch";
      toolCalls: AIToolCall[];
    }
  | {
      reason: string;
      status: "invalid_batch";
      toolCalls: AIToolCall[];
    };

type ExecutedAgentTool = {
  result: AgentToolExecutionResult;
  toolCall: AIToolCall;
};

type AgentToolBatchResult =
  | {
      executed: ExecutedAgentTool[];
      latestObservation: string;
      latestSession?: SandboxSession;
      status: "ok" | "recoverable_failure";
      touchedPaths: string[];
    }
  | {
      code: AgentFailureCode;
      executed: ExecutedAgentTool[];
      latestObservation: string;
      latestSession?: SandboxSession;
      message: string;
      status: "hard_failure";
      touchedPaths: string[];
    };

function hasToolMessageContent(
  result: AgentToolExecutionResult,
): result is Extract<
  AgentToolExecutionResult,
  { status: "ok" | "recoverable_failure" }
> {
  return "toolMessageContent" in result;
}

function previewText(value: string, maxLength = 220) {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...`;
}

function pushRecentEvent(state: AgentRunState, event: string) {
  state.recentEvents.push(event);

  if (state.recentEvents.length > MAX_RECENT_EVENTS) {
    state.recentEvents.shift();
  }
}

function buildAgentSystemPrompt() {
  return [
    "You are Devin's bounded coding agent for one sandbox repository.",
    `You have at most ${MAX_AGENT_STEPS} tool-use turns before the final answer.`,
    "Respond in English.",
    `You may return up to ${MAX_READ_ONLY_TOOL_CALLS} tool calls in one turn only when every call is read-only: list_directory, read_file, or search_code.`,
    "write_file must be used alone.",
    "Search or inspect before editing when the target is unclear.",
    "Prefer bounded reads first.",
    "Request a full-file read only immediately before writing that file.",
    "Only write files you have already inspected.",
    "If the request is unclear or unsupported, answer with JSON containing status, message, and an optional clarificationQuestion.",
    "Do not invent tools, files, commands, or multi-action turns.",
  ].join("\n");
}

function buildAgentFinishPrompt() {
  return [
    "Do not call any tools.",
    "Return the final result as JSON only.",
    'Use this shape: {"status":"completed"|"blocked","message":"...","clarificationQuestion":"optional"}',
    "Do not include markdown fences or any extra prose.",
  ].join("\n");
}

function buildMultiToolRetryPrompt() {
  return [
    "Your previous response returned an invalid tool batch.",
    `Return either exactly one write_file call, or up to ${MAX_READ_ONLY_TOOL_CALLS} read-only tool calls using only list_directory, read_file, and search_code.`,
    "Do not mix write_file with any other tool.",
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

function logAgentModelResponse(
  input: SandboxAgentInput,
  phase: AgentModelPhase,
  step: number,
  response: AIGenerateTextResult,
) {
  console.log("Sandbox agent model response:", {
    hasText: Boolean(response.text.trim()),
    issueNumber: input.issueNumber,
    phase,
    projectId: input.projectId,
    step,
    textPreview: response.text.trim() ? previewText(response.text) : null,
    toolCalls:
      response.toolCalls?.map((toolCall) => ({
        argumentsPreview: previewText(toolCall.function.arguments, 160),
        id: toolCall.id,
        name: toolCall.function.name,
      })) ?? [],
    usage: response.usage,
  });
}

function logAgentToolResult(
  input: SandboxAgentInput,
  step: number,
  toolCall: AIToolCall,
  result: AgentToolExecutionResult,
) {
  console.log("Sandbox agent tool result:", {
    issueNumber: input.issueNumber,
    latestObservationPreview:
      "latestObservation" in result
        ? previewText(result.latestObservation)
        : null,
    projectId: input.projectId,
    recentEvent: result.recentEvent,
    status: result.status,
    step,
    tool: toolCall.function.name,
    toolArgumentsPreview: previewText(toolCall.function.arguments, 160),
    toolMessagePreview:
      "toolMessageContent" in result
        ? previewText(result.toolMessageContent, 220)
        : null,
  });
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

function classifyToolTurn(response: AIGenerateTextResult): ToolTurnClassification {
  const toolCalls = response.toolCalls ?? [];

  if (toolCalls.length === 0) {
    return {
      status: "finish",
    };
  }

  if (toolCalls.length === 1) {
    return {
      status: "single",
      toolCalls: [toolCalls[0]!],
    };
  }

  const allReadOnly = toolCalls.every((toolCall) =>
    READ_ONLY_TOOL_NAMES.has(toolCall.function.name as SandboxAgentToolName),
  );

  if (allReadOnly && toolCalls.length <= MAX_READ_ONLY_TOOL_CALLS) {
    return {
      status: "read_only_batch",
      toolCalls,
    };
  }

  return {
    reason: allReadOnly
      ? `Too many read-only tool calls were returned (${toolCalls.length}).`
      : "write_file was mixed with other tools or an unsupported multi-tool combination was returned.",
    status: "invalid_batch",
    toolCalls,
  };
}

function mergeUsage(previous: AIUsage | undefined, next: AIUsage | undefined) {
  if (!next) {
    return previous;
  }

  return {
    completionTokens: (previous?.completionTokens ?? 0) + next.completionTokens,
    cost:
      previous?.cost === undefined && next.cost === undefined
        ? undefined
        : (previous?.cost ?? 0) + (next.cost ?? 0),
    promptTokens: (previous?.promptTokens ?? 0) + next.promptTokens,
    reasoningTokens:
      previous?.reasoningTokens === undefined && next.reasoningTokens === undefined
        ? undefined
        : (previous?.reasoningTokens ?? 0) + (next.reasoningTokens ?? 0),
    totalTokens: (previous?.totalTokens ?? 0) + next.totalTokens,
  };
}

async function callAgentToolTurn(
  state: AgentRunState,
): Promise<AIGenerateTextResult> {
  return aiProvider.generateText({
    maxTokens: 1_500,
    messages: state.transcript,
    temperature: 0.1,
    toolChoice: "auto",
    tools: sandboxAgentModelTools,
  });
}

async function callAgentFinishTurn(
  state: AgentRunState,
): Promise<AIGenerateTextResult> {
  return aiProvider.generateText({
    maxTokens: 1_500,
    messages: [
      ...state.transcript,
      {
        content: buildAgentFinishPrompt(),
        role: "user",
      },
    ],
    responseFormat: {
      type: "json_schema",
      jsonSchema: {
        name: "sandbox_agent_finish",
        schema: buildFinishResponseSchema(),
        strict: true,
      },
    },
    temperature: 0.1,
    toolChoice: "none",
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
  toolCalls: AIToolCall[],
  toolMessages: Array<{
    toolCallId: string;
    toolMessageContent: string;
  }>,
  assistantContent: string,
) {
  state.transcript.push({
    content: assistantContent,
    role: "assistant",
    tool_calls: toolCalls,
  });
  for (const toolMessage of toolMessages) {
    state.transcript.push({
      content: toolMessage.toolMessageContent,
      role: "tool",
      tool_call_id: toolMessage.toolCallId,
    });
  }
}

function appendAssistantMessage(state: AgentRunState, content: string) {
  if (!content.trim()) {
    return;
  }

  state.transcript.push({
    content,
    role: "assistant",
  });
}

function appendUserMessage(state: AgentRunState, content: string) {
  state.transcript.push({
    content,
    role: "user",
  });
}

function buildBatchObservation(executed: ExecutedAgentTool[]) {
  const observationParts = executed.flatMap((item) =>
    "latestObservation" in item.result ? [item.result.latestObservation] : [],
  );

  return observationParts.join("\n\n");
}

async function executeReadOnlyBatch(
  toolCalls: AIToolCall[],
  sessionId: string,
): Promise<AgentToolBatchResult> {
  const executed: ExecutedAgentTool[] = [];
  const touchedPaths: string[] = [];
  let latestSession: SandboxSession | undefined;
  let hadRecoverableFailure = false;

  for (const toolCall of toolCalls) {
    const result = await executeToolCall(toolCall, sessionId);
    executed.push({
      result,
      toolCall,
    });

    if ("touchedPath" in result && result.touchedPath) {
      touchedPaths.push(result.touchedPath);
    }

    if ("session" in result && result.session) {
      latestSession = result.session;
    }

    if (result.status === "recoverable_failure") {
      hadRecoverableFailure = true;
      continue;
    }

    if (result.status === "hard_failure") {
      return {
        code: result.code,
        executed,
        latestObservation: buildBatchObservation(executed),
        latestSession,
        message: result.message,
        status: "hard_failure",
        touchedPaths,
      };
    }
  }

  return {
    executed,
    latestObservation: buildBatchObservation(executed),
    latestSession,
    status: hadRecoverableFailure ? "recoverable_failure" : "ok",
    touchedPaths,
  };
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
    ...(state.usage ? { usage: state.usage } : {}),
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
    ...(state.usage ? { usage: state.usage } : {}),
  };
}

export async function runSandboxAgent(
  input: SandboxAgentInput,
): Promise<SandboxAgentInternalResult> {
  console.log("Sandbox agent started:", {
    instructionPreview: previewText(input.userInstruction, 240),
    issueNumber: input.issueNumber,
    projectId: input.projectId,
    repoName: input.repoName,
    repoOwner: input.repoOwner,
    sessionId: input.sessionId,
  });

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
    usage: undefined,
  };
  let invalidBatchRetryUsed = false;
  let awaitingInvalidBatchRecovery = false;

  for (let step = 0; step < MAX_AGENT_STEPS; step += 1) {
    let modelResponse: AIGenerateTextResult;

    try {
      modelResponse = await callAgentToolTurn(state);
    } catch (error) {
      console.error("Sandbox agent tool turn failed:", error);
      const mappedError = mapModelError(error);

      return buildFailedResult(input, state, mappedError.code, mappedError.message);
    }

    state.stepsUsed += 1;
    state.usage = mergeUsage(state.usage, modelResponse.usage);
    logAgentModelResponse(input, "tool", state.stepsUsed, modelResponse);

    const toolTurn = classifyToolTurn(modelResponse);

    if (toolTurn.status === "invalid_batch") {
      console.warn("Sandbox agent returned an invalid tool batch:", {
        issueNumber: input.issueNumber,
        projectId: input.projectId,
        reason: toolTurn.reason,
        step: state.stepsUsed,
        toolNames: toolTurn.toolCalls.map((toolCall) => toolCall.function.name),
      });

      if (invalidBatchRetryUsed) {
        console.error("Sandbox agent invalid batch retry exhausted:", {
          issueNumber: input.issueNumber,
          projectId: input.projectId,
          step: state.stepsUsed,
        });
        return buildFailedResult(
          input,
          state,
          "internal_error",
          "The agent returned an invalid tool batch and could not recover.",
        );
      }

      appendAssistantMessage(state, modelResponse.text);
      appendUserMessage(state, buildMultiToolRetryPrompt());
      invalidBatchRetryUsed = true;
      awaitingInvalidBatchRecovery = true;
      continue;
    }

    if (awaitingInvalidBatchRecovery) {
      console.log("Sandbox agent invalid batch retry recovered:", {
        issueNumber: input.issueNumber,
        projectId: input.projectId,
        step: state.stepsUsed,
      });
      awaitingInvalidBatchRecovery = false;
    }

    if (toolTurn.status === "finish") {
      appendAssistantMessage(state, modelResponse.text);

      let finishTurnResponse: AIGenerateTextResult;

      try {
        finishTurnResponse = await callAgentFinishTurn(state);
      } catch (error) {
        console.error("Sandbox agent finish turn failed:", error);
        const mappedError = mapModelError(error);

        return buildFailedResult(input, state, mappedError.code, mappedError.message);
      }

      state.stepsUsed += 1;
      state.usage = mergeUsage(state.usage, finishTurnResponse.usage);
      logAgentModelResponse(input, "finish", state.stepsUsed, finishTurnResponse);

      let finishResponse: z.infer<typeof finishSchema>;

      try {
        finishResponse = parseFinishResponse(finishTurnResponse.text);
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

    if (toolTurn.status === "single") {
      const toolCall = toolTurn.toolCalls[0];
      const toolResult = await executeToolCall(toolCall, input.sessionId);
      logAgentToolResult(input, state.stepsUsed, toolCall, toolResult);

      pushRecentEvent(state, toolResult.recentEvent);

      if (toolResult.status === "hard_failure") {
        return buildFailedResult(input, state, toolResult.code, toolResult.message);
      }

      appendToolMessages(
        state,
        [toolCall],
        [
          {
            toolCallId: toolCall.id,
            toolMessageContent: toolResult.toolMessageContent,
          },
        ],
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

      continue;
    }

    const batchResult = await executeReadOnlyBatch(
      toolTurn.toolCalls,
      input.sessionId,
    );

    for (const executedTool of batchResult.executed) {
      logAgentToolResult(
        input,
        state.stepsUsed,
        executedTool.toolCall,
        executedTool.result,
      );
      pushRecentEvent(state, executedTool.result.recentEvent);
    }

    if (batchResult.status === "hard_failure") {
      for (const touchedPath of batchResult.touchedPaths) {
        state.filesTouched.add(touchedPath);
      }

      if (batchResult.latestSession) {
        state.latestSession = batchResult.latestSession;
      }

      if (batchResult.latestObservation) {
        state.latestObservation = batchResult.latestObservation;
      }

      return buildFailedResult(input, state, batchResult.code, batchResult.message);
    }

    appendToolMessages(
      state,
      toolTurn.toolCalls,
      batchResult.executed.flatMap((executedTool) =>
        hasToolMessageContent(executedTool.result)
          ? [
              {
                toolCallId: executedTool.toolCall.id,
                toolMessageContent: executedTool.result.toolMessageContent,
              },
            ]
          : [],
      ),
      modelResponse.text,
    );
    state.latestObservation = batchResult.latestObservation;

    for (const touchedPath of batchResult.touchedPaths) {
      state.filesTouched.add(touchedPath);
    }

    if (batchResult.latestSession) {
      state.latestSession = batchResult.latestSession;
    }

    if (batchResult.status === "recoverable_failure") {
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
  }

  return buildAgentResult(input, state, {
    message: "The agent reached its step limit before finishing.",
    status: "max_steps_reached",
  });
}
