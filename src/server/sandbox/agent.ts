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

import AGENT_FINISH_PROMPT_TEMPLATE from "./prompts/agent-finish.txt";
import AGENT_MULTITOOL_RETRY_PROMPT_TEMPLATE from "./prompts/agent-multitool-retry.txt";
import AGENT_SYSTEM_PROMPT_TEMPLATE from "./prompts/agent-system.txt";
import AGENT_TERMINAL_FAILURE_FINISH_PROMPT_TEMPLATE from "./prompts/agent-terminal-failure-finish.txt";

const MAX_RECENT_EVENTS = 5;
const MAX_LIST_DIRECTORY_ENTRIES = 40;
const MAX_READ_ONLY_TOOL_CALLS = 5;
const MAX_RECOVERY_TURNS = 5;
const MAX_SAME_FAILURE_REPEATS = 3;

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

type SandboxAgentInternalResult = SandboxAgentResult & {
  failureCode?: AgentFailureCode;
};

type AgentRunState = {
  filesTouched: Set<string>;
  lastFailureSignature?: string;
  latestObservation: string;
  latestSession?: SandboxSession;
  recentEvents: string[];
  recoveryTurnsUsed: number;
  sameFailureRepeatCount: number;
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

type AgentToolFailure = {
  code: string;
  latestObservation: string;
  message: string;
  recentEvent: string;
  status: "tool_failure";
  tool: SandboxAgentToolName;
  toolMessageContent: string;
};

type AgentToolInternalFatalFailure = {
  code: AgentFailureCode;
  message: string;
  recentEvent: string;
  status: "internal_fatal_failure";
};

type AgentToolExecutionResult =
  | ({ status: "ok" } & AgentToolSuccess)
  | AgentToolFailure
  | AgentToolInternalFatalFailure;

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
      status: "ok" | "tool_failure";
      touchedPaths: string[];
    }
  | {
      code: AgentFailureCode;
      executed: ExecutedAgentTool[];
      latestObservation: string;
      latestSession?: SandboxSession;
      message: string;
      status: "internal_fatal_failure";
      touchedPaths: string[];
    };

function hasToolMessageContent(
  result: AgentToolExecutionResult,
): result is Extract<
  AgentToolExecutionResult,
  {
    status: "ok" | "tool_failure";
  }
> {
  return "toolMessageContent" in result;
}

type AgentRetryExhaustedResult = {
  code: AgentFailureCode;
  latestObservation: string;
  message: string;
  recentEvent: string;
  toolMessageContent: string;
};

type ToolFailureMessageInput = {
  argumentsValue: Record<string, unknown>;
  code: string;
  message: string;
  retryable: boolean;
  tool: SandboxAgentToolName;
};

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

function formatPromptTemplate(
  template: string,
  replacements: Record<string, string> = {},
) {
  return Object.entries(replacements).reduce(
    (content, [key, value]) => content.replaceAll(`{{${key}}}`, value),
    template,
  ).trim();
}

function buildAgentSystemPrompt() {
  return formatPromptTemplate(AGENT_SYSTEM_PROMPT_TEMPLATE, {
    MAX_READ_ONLY_TOOL_CALLS: String(MAX_READ_ONLY_TOOL_CALLS),
  });
}

function buildAgentFinishPrompt() {
  return formatPromptTemplate(AGENT_FINISH_PROMPT_TEMPLATE);
}

function buildTerminalFailureFinishPrompt() {
  return formatPromptTemplate(AGENT_TERMINAL_FAILURE_FINISH_PROMPT_TEMPLATE);
}

function buildMultiToolRetryPrompt() {
  return formatPromptTemplate(AGENT_MULTITOOL_RETRY_PROMPT_TEMPLATE, {
    MAX_READ_ONLY_TOOL_CALLS: String(MAX_READ_ONLY_TOOL_CALLS),
  });
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

function buildToolFailureMessageContent(input: ToolFailureMessageInput) {
  return JSON.stringify({
    arguments: input.argumentsValue,
    code: input.code,
    message: input.message,
    ok: false,
    retryable: input.retryable,
    tool: input.tool,
  });
}

function buildToolFailureResult(
  tool: SandboxAgentToolName,
  message: string,
  argumentsValue: Record<string, unknown>,
): AgentToolFailure {
  return {
    code: message,
    latestObservation: formatToolFeedback(tool, message),
    message,
    recentEvent: `${tool} failed: ${message}.`,
    status: "tool_failure",
    tool,
    toolMessageContent: buildToolFailureMessageContent({
      argumentsValue,
      code: message,
      message,
      retryable: true,
      tool,
    }),
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

function buildFailureSignature(
  tool: SandboxAgentToolName,
  code: string,
  argumentsValue: Record<string, unknown>,
) {
  return `${tool}:${code}:${JSON.stringify(argumentsValue)}`;
}

function buildFailureTurnSignature(signatures: string[]) {
  return Array.from(new Set(signatures)).sort().join("||");
}

function parseToolCallArguments(toolCall: AIToolCall): Record<string, unknown> {
  try {
    return JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
  } catch {
    return { _raw: toolCall.function.arguments };
  }
}

function buildRetryExhaustedResult(
  tool: SandboxAgentToolName,
  argumentsValue: Record<string, unknown>,
): AgentRetryExhaustedResult {
  return {
    code: "tool_retry_exhausted",
    latestObservation: [
      `The previous ${tool} call could not be recovered after several retries.`,
      "Stop using tools and explain the repeated failure to the user.",
    ].join("\n"),
    message: "The agent could not recover from a repeated tool error.",
    recentEvent: `The recovery budget was exhausted for ${tool}.`,
    toolMessageContent: buildToolFailureMessageContent({
      argumentsValue,
      code: "tool_retry_exhausted",
      message: "The agent could not recover from a repeated tool error.",
      retryable: false,
      tool,
    }),
  };
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
      : "A write-like tool was mixed with other tools or an unsupported multi-tool combination was returned.",
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
  finishPrompt = buildAgentFinishPrompt(),
): Promise<AIGenerateTextResult> {
  return aiProvider.generateText({
    maxTokens: 1_500,
    messages: [
      ...state.transcript,
      {
        content: finishPrompt,
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
      status: "internal_fatal_failure",
    };
  }

  const toolName = toolCall.function.name;
  const tool = getSandboxAgentTool(toolName);

  if (!tool) {
    return {
      code: "internal_error",
      message: "The agent could not continue because a sandbox tool was missing.",
      recentEvent: `A tool was requested but not found: ${toolName}`,
      status: "internal_fatal_failure",
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
      case "replace_in_file": {
        const replaceResult = result as {
          path: string;
          session: SandboxSession;
          startLine: number;
        };

        return {
          latestObservation: `replace_in_file updated ${replaceResult.path} line ${replaceResult.startLine}.`,
          recentEvent: `Replaced text in ${replaceResult.path} line ${replaceResult.startLine}.`,
          session: replaceResult.session,
          status: "ok",
          toolMessageContent,
          touchedPath: replaceResult.path,
        };
      }
    }

    return {
      code: "internal_error",
      message: "The agent could not continue because a sandbox tool was not handled.",
      recentEvent: `A tool completed but had no formatter: ${toolName}`,
      status: "internal_fatal_failure",
    };
  } catch (error) {
    const argumentsValue =
      error instanceof SyntaxError
        ? { _raw: toolCall.function.arguments }
        : parseToolCallArguments(toolCall);
    const message =
      error instanceof SyntaxError
        ? "invalid_tool_arguments_json"
        : normalizeToolErrorMessage(error);

    return buildToolFailureResult(toolName, message, argumentsValue);
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

function getToolFailures(executed: ExecutedAgentTool[]) {
  return executed.filter(
    (item): item is {
      result: AgentToolFailure;
      toolCall: AIToolCall;
    } => item.result.status === "tool_failure",
  );
}

function registerRecoveryAttempt(
  state: AgentRunState,
  toolFailures: Array<{
    result: AgentToolFailure;
    toolCall: AIToolCall;
  }>,
) {
  state.recoveryTurnsUsed += 1;

  const signatures = toolFailures.map((item) =>
    buildFailureSignature(
      item.result.tool,
      item.result.code,
      parseToolCallArguments(item.toolCall),
    ),
  );
  const turnSignature = buildFailureTurnSignature(signatures);

  if (state.lastFailureSignature === turnSignature) {
    state.sameFailureRepeatCount += 1;
  } else {
    state.lastFailureSignature = turnSignature;
    state.sameFailureRepeatCount = 1;
  }

  if (state.recoveryTurnsUsed >= MAX_RECOVERY_TURNS) {
    const firstFailure = toolFailures[0]!;
    return buildRetryExhaustedResult(
      firstFailure.result.tool,
      parseToolCallArguments(firstFailure.toolCall),
    );
  }

  if (state.sameFailureRepeatCount >= MAX_SAME_FAILURE_REPEATS) {
    const firstFailure = toolFailures[0]!;
    return buildRetryExhaustedResult(
      firstFailure.result.tool,
      parseToolCallArguments(firstFailure.toolCall),
    );
  }

  return null;
}

function resetRecoveryTracking(state: AgentRunState) {
  state.lastFailureSignature = undefined;
  state.sameFailureRepeatCount = 0;
}

async function executeReadOnlyBatch(
  toolCalls: AIToolCall[],
  sessionId: string,
): Promise<AgentToolBatchResult> {
  const executed: ExecutedAgentTool[] = [];
  const touchedPaths: string[] = [];
  let latestSession: SandboxSession | undefined;
  let hadToolFailure = false;

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

    if (result.status === "internal_fatal_failure") {
      return {
        code: result.code,
        executed,
        latestObservation: buildBatchObservation(executed),
        latestSession,
        message: result.message,
        status: "internal_fatal_failure",
        touchedPaths,
      };
    }

    if (result.status === "tool_failure") {
      hadToolFailure = true;
    }
  }

  return {
    executed,
    latestObservation: buildBatchObservation(executed),
    latestSession,
    status: hadToolFailure ? "tool_failure" : "ok",
    touchedPaths,
  };
}

async function buildAgentResult(
  input: SandboxAgentInput,
  state: AgentRunState,
  result: Omit<
    SandboxAgentResult,
    "diff" | "filesTouched" | "session" | "stepsUsed"
  > & {
    failureCode?: AgentFailureCode;
  },
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

async function finalizeWithFinishTurn(
  input: SandboxAgentInput,
  state: AgentRunState,
  finishPrompt: string,
  failureCode?: AgentFailureCode,
  preferredDisplayMessage?: string,
) {
  let finishTurnResponse: AIGenerateTextResult;

  try {
    finishTurnResponse = await callAgentFinishTurn(state, finishPrompt);
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
    failureCode,
    message: preferredDisplayMessage?.trim() || finishResponse.message,
    status: failureCode ? "blocked" : finishResponse.status,
  });
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
    lastFailureSignature: undefined,
    latestObservation: "No tool has been called yet.",
    recentEvents: [],
    recoveryTurnsUsed: 0,
    sameFailureRepeatCount: 0,
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

  while (true) {
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
      return finalizeWithFinishTurn(
        input,
        state,
        buildAgentFinishPrompt(),
        undefined,
        modelResponse.text,
      );
    }

    if (toolTurn.status === "single") {
      const toolCall = toolTurn.toolCalls[0];
      const toolResult = await executeToolCall(toolCall, input.sessionId);
      logAgentToolResult(input, state.stepsUsed, toolCall, toolResult);

      pushRecentEvent(state, toolResult.recentEvent);

      if (toolResult.status === "internal_fatal_failure") {
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

      if (toolResult.status === "tool_failure") {
        const exhaustedFailure = registerRecoveryAttempt(state, [
          { result: toolResult, toolCall },
        ]);

        if (exhaustedFailure) {
          pushRecentEvent(state, exhaustedFailure.recentEvent);
          state.latestObservation = exhaustedFailure.latestObservation;
          appendUserMessage(
            state,
            [
              "Recovery for the previous retryable tool failure is exhausted.",
              exhaustedFailure.toolMessageContent,
              "Explain the issue to the user and stop.",
            ].join("\n"),
          );

          return finalizeWithFinishTurn(
            input,
            state,
            buildTerminalFailureFinishPrompt(),
            exhaustedFailure.code,
          );
        }

        continue;
      }

      resetRecoveryTracking(state);

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

    if (batchResult.status === "internal_fatal_failure") {
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

    if (batchResult.status === "tool_failure") {
      const exhaustedFailure = registerRecoveryAttempt(
        state,
        getToolFailures(batchResult.executed),
      );

      if (exhaustedFailure) {
        pushRecentEvent(state, exhaustedFailure.recentEvent);
        appendUserMessage(
          state,
          [
            "Recovery for the previous retryable tool failures is exhausted.",
            exhaustedFailure.toolMessageContent,
            "Explain the issue to the user and stop.",
          ].join("\n"),
        );

        return finalizeWithFinishTurn(
          input,
          state,
          buildTerminalFailureFinishPrompt(),
          exhaustedFailure.code,
        );
      }

      continue;
    }

    resetRecoveryTracking(state);
  }
}
