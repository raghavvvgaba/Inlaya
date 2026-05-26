import "server-only";

export type AIMessage = {
  content: string;
  role: "assistant" | "system" | "user";
};

export type AIJsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type AIGenerateTextInput = {
  maxTokens?: number;
  messages: AIMessage[];
  model?: string;
  responseFormat?:
    | {
        jsonSchema: AIJsonSchema;
        type: "json_schema";
      }
    | {
        type: "text";
      };
  temperature?: number;
};

export type AIGenerateTextResult = {
  model: string;
  text: string;
};

export type AIProvider = {
  generateText: (input: AIGenerateTextInput) => Promise<AIGenerateTextResult>;
};
