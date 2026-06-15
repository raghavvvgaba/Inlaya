import "server-only";

import { z } from "zod";

import { readSandboxFile } from "~/server/sandbox/tools/read-file";
import type { SandboxFile } from "~/server/sandbox/types";

import DESCRIPTION from "./read.txt";
import type { SandboxAgentToolDefinition } from "./types";

const readArgumentsSchema = z
  .object({
    endLine: z.number().int().optional(),
    path: z.string(),
    startLine: z.number().int().optional(),
  })
  .strict();

type ReadSandboxAgentToolArguments = z.infer<typeof readArgumentsSchema>;

export const readSandboxAgentTool = {
  description: DESCRIPTION,
  async execute(args, context) {
    const parsedArguments = readArgumentsSchema.parse(args);

    return readSandboxFile({
      endLine: parsedArguments.endLine,
      path: parsedArguments.path,
      sessionId: context.sessionId,
      startLine: parsedArguments.startLine,
    });
  },
  id: "read_file",
  parameters: {
    additionalProperties: false,
    properties: {
      endLine: {
        description: "Optional inclusive ending line number.",
        type: "integer",
      },
      path: {
        description: "Repository-relative file path to read.",
        type: "string",
      },
      startLine: {
        description: "Optional starting line number.",
        type: "integer",
      },
    },
    required: ["path"],
    type: "object",
  },
} satisfies SandboxAgentToolDefinition<
  ReadSandboxAgentToolArguments,
  SandboxFile
>;
