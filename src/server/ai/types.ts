import "server-only";

export type AIReasoningState =
  | {
      details: unknown[];
      type: "details";
    }
  | {
      text: string;
      type: "text";
    };

export type AIReasoningConfig = {
  enabled?: boolean;
  exclude?: boolean;
};

export type AIMessage =
  | {
      content: string;
      name?: string;
      role: "system" | "user";
    }
  | {
      content: string;
      name?: string;
      reasoning?: string;
      reasoning_details?: unknown[];
      role: "assistant";
      tool_calls?: AIToolCall[];
    }
  | {
      content: string;
      name?: string;
      role: "tool";
      tool_call_id: string;
    };

export type AIJsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type AIToolDefinition = {
  function: {
    description?: string;
    name: string;
    parameters: Record<string, unknown>;
    strict?: boolean;
  };
  type: "function";
};

export type AIToolChoice =
  | "auto"
  | "none"
  | {
      function: {
        name: string;
      };
      type: "function";
    };

export type AIToolCall = {
  function: {
    arguments: string;
    name: string;
  };
  id: string;
  type: "function";
};

export type AIUsage = {
  completionTokens: number;
  cost?: number;
  promptTokens: number;
  reasoningTokens?: number;
  totalTokens: number;
};

export type AIGenerateTextInput = {
  maxTokens?: number;
  messages: AIMessage[];
  model?: string;
  onTextDelta?: (delta: string) => Promise<void> | void;
  reasoning?: AIReasoningConfig;
  responseFormat?:
    | {
        jsonSchema: AIJsonSchema;
        type: "json_schema";
      }
    | {
        type: "text";
      };
  temperature?: number;
  stream?: boolean;
  toolChoice?: AIToolChoice;
  tools?: AIToolDefinition[];
};

export type AIGenerateTextResult = {
  model: string;
  reasoning?: AIReasoningState;
  text: string;
  timeToFirstOutputMs?: number;
  toolCalls?: AIToolCall[];
  usage?: AIUsage;
};

export type AIProvider = {
  generateText: (input: AIGenerateTextInput) => Promise<AIGenerateTextResult>;
};
