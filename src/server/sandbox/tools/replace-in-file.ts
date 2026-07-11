import "server-only";

/** Implements the app-owned replace_in_file sandbox tool. */

import { z } from "zod";

import { sandboxProvider } from "~/server/sandbox/provider";
import { assertSandboxFileContentSize } from "~/server/sandbox/tools/files";
import type { SandboxAgentToolDefinition } from "~/server/sandbox/tools/types";
import type { SandboxSession } from "~/server/sandbox/types";

import DESCRIPTION from "./replace.txt";

export const REPLACE_CANDIDATE_LINE_CAP = 5;

type ReplaceInFileInput = {
  newText: string;
  oldText: string;
  path: string;
  sessionId: string;
  startLine: number;
};

type ReplaceInFileResult = {
  newText: string;
  oldText: string;
  path: string;
  session: SandboxSession;
  startLine: number;
};

function countOccurrences(value: string, search: string) {
  let count = 0;
  let index = value.indexOf(search);

  while (index !== -1) {
    count += 1;
    index = value.indexOf(search, index + search.length);
  }

  return count;
}

function buildLineTextMismatchMessage(lines: string[], oldText: string) {
  const candidateLines = lines
    .map((line, index) => (line.includes(oldText) ? index + 1 : undefined))
    .filter((line): line is number => line !== undefined);

  if (candidateLines.length === 0) {
    return "line_text_mismatch: oldText was not found elsewhere in the file";
  }

  const visibleCandidates = candidateLines.slice(0, REPLACE_CANDIDATE_LINE_CAP);
  const remainingCount = candidateLines.length - visibleCandidates.length;

  return [
    `line_text_mismatch: oldText found on candidate ${visibleCandidates.length === 1 ? "line" : "lines"} ${visibleCandidates.join(", ")}`,
    ...(remainingCount > 0 ? [`and ${remainingCount} more`] : []),
  ].join(" ");
}

export async function replaceSandboxFileText(
  input: ReplaceInFileInput,
): Promise<ReplaceInFileResult> {
  if (input.startLine < 1) {
    throw new Error("invalid_line_range");
  }

  if (!input.oldText) {
    throw new Error("missing_old_text");
  }

  const rawFile = await sandboxProvider.readRawFile({
    path: input.path,
    sessionId: input.sessionId,
  });
  const normalizedContent = rawFile.content.replace(/\r\n/g, "\n");
  const lines = normalizedContent === "" ? [] : normalizedContent.split("\n");
  const lineIndex = input.startLine - 1;
  const currentLine = lines[lineIndex];

  if (currentLine === undefined) {
    throw new Error("line_not_found");
  }

  const matchCount = countOccurrences(currentLine, input.oldText);

  if (matchCount === 0) {
    throw new Error(buildLineTextMismatchMessage(lines, input.oldText));
  }

  if (matchCount > 1) {
    throw new Error("ambiguous_line_match");
  }

  lines[lineIndex] = currentLine.replace(input.oldText, input.newText);

  const content = lines.join("\n");
  assertSandboxFileContentSize(content);

  const writeResult = await sandboxProvider.writeRawFile({
    content,
    path: input.path,
    sessionId: input.sessionId,
  });

  return {
    newText: input.newText,
    oldText: input.oldText,
    path: writeResult.path,
    session: writeResult.session,
    startLine: input.startLine,
  };
}

const replaceArgumentsSchema = z
  .object({
    newText: z.string(),
    oldText: z.string(),
    path: z.string(),
    startLine: z.number().int(),
  })
  .strict();

type ReplaceSandboxAgentToolArguments = z.infer<typeof replaceArgumentsSchema>;

export const replaceSandboxAgentTool = {
  description: DESCRIPTION,
  async execute(args, context) {
    const parsedArguments = replaceArgumentsSchema.parse(args);

    return replaceSandboxFileText({
      newText: parsedArguments.newText,
      oldText: parsedArguments.oldText,
      path: parsedArguments.path,
      sessionId: context.sessionId,
      startLine: parsedArguments.startLine,
    });
  },
  id: "replace_in_file",
  parameters: {
    additionalProperties: false,
    properties: {
      newText: {
        description: "Replacement text for the matched text on the target line.",
        type: "string",
      },
      oldText: {
        description: "Exact existing text expected on the target line.",
        type: "string",
      },
      path: {
        description: "Repository-relative file path to edit.",
        type: "string",
      },
      startLine: {
        description: "One-based line number where oldText is expected.",
        type: "integer",
      },
    },
    required: ["path", "startLine", "oldText", "newText"],
    type: "object",
  },
} satisfies SandboxAgentToolDefinition<
  ReplaceSandboxAgentToolArguments,
  ReplaceInFileResult
>;
