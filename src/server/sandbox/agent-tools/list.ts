import "server-only";

import { z } from "zod";

import { listSandboxFiles } from "~/server/sandbox/tools/list-directory";
import type { SandboxFileEntry } from "~/server/sandbox/types";

import DESCRIPTION from "./list.txt";
import type { SandboxAgentToolDefinition } from "./types";

const listArgumentsSchema = z
  .object({
    path: z.string().optional(),
  })
  .strict();

type ListSandboxAgentToolArguments = z.infer<typeof listArgumentsSchema>;

export const listSandboxAgentTool = {
  description: DESCRIPTION,
  async execute(args, context) {
    const parsedArguments = listArgumentsSchema.parse(args);

    return listSandboxFiles({
      path: parsedArguments.path ?? "",
      sessionId: context.sessionId,
    });
  },
  id: "list_directory",
  parameters: {
    additionalProperties: false,
    properties: {
      path: {
        description: "Optional repository-relative path to inspect.",
        type: "string",
      },
    },
    type: "object",
  },
} satisfies SandboxAgentToolDefinition<
  ListSandboxAgentToolArguments,
  SandboxFileEntry[]
>;
