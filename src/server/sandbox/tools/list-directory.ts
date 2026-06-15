import "server-only";

/** Implements the app-owned list_directory sandbox tool. */

import { z } from "zod";

import type { SandboxAgentToolDefinition } from "~/server/sandbox/tools/types";
import { sandboxProvider } from "~/server/sandbox/provider";
import type { SandboxFileEntry, SandboxListFilesInput } from "~/server/sandbox/types";

import DESCRIPTION from "./list.txt";

export async function listSandboxFiles(
  input: SandboxListFilesInput,
): Promise<SandboxFileEntry[]> {
  return sandboxProvider.listRawFiles(input);
}

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
