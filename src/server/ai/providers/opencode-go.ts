import "server-only";

import { env } from "~/env";
import type {
  AIGenerateTextInput,
  AIGenerateTextResult,
  AIProvider,
  AIToolCall,
  AIUsage,
} from "~/server/ai/types";

const OPENCODE_GO_URL = "https://opencode.ai/zen/go/v1/chat/completions";
const DEFAULT_OPENCODE_GO_MODEL = "deepseek-v4-flash";

type OpenCodeGoMessageContent =
  | string
  | Array<{
      text?: string;
      type?: string;
    }>;

type OpenCodeGoResponse = {
  choices?: Array<{
    message?: {
      content?: OpenCodeGoMessageContent;
      tool_calls?: Array<{
        function?: {
          arguments?: string;
          name?: string;
        };
        id?: string;
        type?: string;
      }>;
    };
  }>;
  model?: string;
  usage?: {
    completion_tokens?: number;
    completion_tokens_details?: {
      reasoning_tokens?: number;
    };
    cost?: number;
    prompt_tokens?: number;
    total_tokens?: number;
  };
};

function getResponseText(response: OpenCodeGoResponse) {
  const content = response.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (part?.type === "text" ? part.text ?? "" : ""))
      .join("");
  }

  return "";
}

function getToolCalls(response: OpenCodeGoResponse): AIToolCall[] {
  const toolCalls = response.choices?.[0]?.message?.tool_calls;

  if (!Array.isArray(toolCalls)) {
    return [];
  }

  return toolCalls.flatMap((toolCall, index) => {
    if (
      toolCall?.type !== "function" ||
      !toolCall.function?.name ||
      typeof toolCall.function.arguments !== "string"
    ) {
      return [];
    }

    return [
      {
        function: {
          arguments: toolCall.function.arguments,
          name: toolCall.function.name,
        },
        id: toolCall.id ?? `tool_call_${index}`,
        type: "function",
      } satisfies AIToolCall,
    ];
  });
}

function getUsage(response: OpenCodeGoResponse): AIUsage | undefined {
  const usage = response.usage;

  if (
    typeof usage?.prompt_tokens !== "number" ||
    typeof usage.completion_tokens !== "number" ||
    typeof usage.total_tokens !== "number"
  ) {
    return undefined;
  }

  return {
    completionTokens: usage.completion_tokens,
    cost: usage.cost,
    promptTokens: usage.prompt_tokens,
    reasoningTokens: usage.completion_tokens_details?.reasoning_tokens,
    totalTokens: usage.total_tokens,
  };
}

function getOpenCodeGoModel(modelOverride?: string) {
  return modelOverride ?? env.OPENCODE_GO_MODEL ?? DEFAULT_OPENCODE_GO_MODEL;
}

async function generateText(
  input: AIGenerateTextInput,
): Promise<AIGenerateTextResult> {
  if (!env.OPENCODE_API_KEY) {
    throw new Error(
      "OpenCode Go is not configured. Set OPENCODE_API_KEY to enable AI requests.",
    );
  }

  const model = getOpenCodeGoModel(input.model);

  let response: Response;

  try {
    response = await fetch(OPENCODE_GO_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENCODE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        max_tokens: input.maxTokens,
        messages: input.messages,
        model,
        response_format:
          input.responseFormat?.type === "json_schema"
            ? {
                type: "json_schema",
                json_schema: {
                  name: input.responseFormat.jsonSchema.name,
                  strict: input.responseFormat.jsonSchema.strict ?? true,
                  schema: input.responseFormat.jsonSchema.schema,
                },
              }
            : undefined,
        temperature: input.temperature,
        tool_choice: input.toolChoice,
        tools: input.tools,
      }),
      cache: "no-store",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    throw new Error(`OpenCode Go request failed. ${message}`);
  }

  if (!response.ok) {
    const bodyText = await response.text();
    const preview = bodyText.trim().replace(/\s+/g, " ").slice(0, 280);

    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `OpenCode Go authentication failed.${preview ? ` Response: ${preview}` : ""}`,
      );
    }

    if (response.status === 429) {
      throw new Error(
        `OpenCode Go request was rate limited.${preview ? ` Response: ${preview}` : ""}`,
      );
    }

    throw new Error(
      `OpenCode Go request failed with status ${response.status}.${preview ? ` Response: ${preview}` : ""}`,
    );
  }

  let data: OpenCodeGoResponse;

  try {
    data = (await response.json()) as OpenCodeGoResponse;
  } catch {
    throw new Error("OpenCode Go returned invalid JSON.");
  }

  const text = getResponseText(data);
  const toolCalls = getToolCalls(data);
  const usage = getUsage(data);

  if (!text && toolCalls.length === 0) {
    throw new Error("OpenCode Go returned an empty response.");
  }

  return {
    model: data.model ?? model,
    text,
    ...(toolCalls.length > 0 ? { toolCalls } : {}),
    ...(usage ? { usage } : {}),
  };
}

export const opencodeGoAiProvider: AIProvider = {
  generateText,
};