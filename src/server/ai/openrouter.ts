import { z } from "zod";

import { env } from "~/env";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MAX_SOURCE_CHARACTERS = 4_000;
const MAX_RESULT_CHARACTERS = 6_000;

const aiEditSchema = z.object({
  summary: z.string().trim().min(1).max(240),
  updatedContent: z.string(),
});

type OpenRouterSuccess = {
  model: string;
  status: "ok";
  summary: string;
  updatedContent: string;
};

type OpenRouterFailureStatus =
  | "error"
  | "invalid_response"
  | "missing_api_key"
  | "model_error"
  | "no_changes"
  | "unsupported_file";

type OpenRouterFailure = {
  status: OpenRouterFailureStatus;
};

export type GenerateSingleFileEditResult = OpenRouterSuccess | OpenRouterFailure;

type GenerateSingleFileEditInput = {
  filePath: string;
  issueTitle: string;
  originalContent: string;
  repoName: string;
  repoOwner: string;
  userInstruction: string;
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string; type?: string }>;
    };
  }>;
  model?: string;
};

function getResponseText(response: OpenRouterResponse) {
  const content = response.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (part?.type === "text" ? part.text ?? "" : ""))
      .join("");
  }

  return null;
}

function looksLikeUnsupportedText(content: string) {
  if (content.length > MAX_SOURCE_CHARACTERS) {
    return true;
  }

  return content.includes("\u0000");
}

function looksLikeInvalidResult(
  originalContent: string,
  updatedContent: string,
  userInstruction: string,
) {
  if (updatedContent.length === 0 && !/\bempty|clear|delete|remove all\b/i.test(userInstruction)) {
    return true;
  }

  if (updatedContent.length > MAX_RESULT_CHARACTERS) {
    return true;
  }

  if (updatedContent === originalContent) {
    return "no_changes" as const;
  }

  return false;
}

function buildSystemPrompt() {
  return [
    "You are a precise single-file code editor.",
    "You may edit exactly one existing text file.",
    "Return valid JSON matching the provided schema.",
    "Do not include markdown fences or prose outside JSON.",
    "Preserve unrelated content and formatting unless the instruction requires changing it.",
    "Do not invent files, commands, or multi-file changes.",
  ].join(" ");
}

function buildUserPrompt(input: GenerateSingleFileEditInput) {
  return [
    `Repository: ${input.repoOwner}/${input.repoName}`,
    `Issue title: ${input.issueTitle}`,
    `Target file: ${input.filePath}`,
    "",
    "Instruction:",
    input.userInstruction,
    "",
    "Current file content:",
    "```",
    input.originalContent,
    "```",
    "",
    "Return JSON with:",
    '- "summary": short sentence describing the file change',
    '- "updatedContent": the full final contents of the file after applying the instruction',
  ].join("\n");
}

export async function generateSingleFileEdit(
  input: GenerateSingleFileEditInput,
): Promise<GenerateSingleFileEditResult> {
  if (!env.OPENROUTER_API_KEY) {
    return { status: "missing_api_key" };
  }

  if (!env.OPENROUTER_MODEL) {
    return { status: "model_error" };
  }

  if (looksLikeUnsupportedText(input.originalContent)) {
    return { status: "unsupported_file" };
  }

  let response: Response;

  try {
    response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": new URL(env.GITHUB_APP_CALLBACK_URL).origin,
        "X-OpenRouter-Title": "Devin",
      },
      body: JSON.stringify({
        max_tokens: 3_000,
        messages: [
          {
            content: buildSystemPrompt(),
            role: "system",
          },
          {
            content: buildUserPrompt(input),
            role: "user",
          },
        ],
        model: env.OPENROUTER_MODEL,
        provider: {
          data_collection: "deny",
          require_parameters: true,
        },
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "single_file_edit",
            strict: true,
            schema: {
              additionalProperties: false,
              properties: {
                summary: {
                  maxLength: 240,
                  minLength: 1,
                  type: "string",
                },
                updatedContent: {
                  type: "string",
                },
              },
              required: ["summary", "updatedContent"],
              type: "object",
            },
          },
        },
        temperature: 0.1,
      }),
      cache: "no-store",
    });
  } catch {
    return { status: "model_error" };
  }

  if (!response.ok) {
    return {
      status: response.status === 401 || response.status === 403 ? "missing_api_key" : "model_error",
    };
  }

  let data: OpenRouterResponse;

  try {
    data = (await response.json()) as OpenRouterResponse;
  } catch {
    return { status: "invalid_response" };
  }

  const responseText = getResponseText(data);

  if (!responseText) {
    return { status: "invalid_response" };
  }

  let parsed: z.infer<typeof aiEditSchema>;

  try {
    parsed = aiEditSchema.parse(JSON.parse(responseText));
  } catch {
    return { status: "invalid_response" };
  }

  const invalidResult = looksLikeInvalidResult(
    input.originalContent,
    parsed.updatedContent,
    input.userInstruction,
  );

  if (invalidResult) {
    return { status: invalidResult === "no_changes" ? "no_changes" : "invalid_response" };
  }

  return {
    model: data.model ?? env.OPENROUTER_MODEL,
    status: "ok",
    summary: parsed.summary,
    updatedContent: parsed.updatedContent,
  };
}
