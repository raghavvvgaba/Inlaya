import "server-only";

import { z } from "zod";

import { writeSandboxFile } from "~/server/sandbox/tools/write-file";
import type { SandboxSession } from "~/server/sandbox/types";

import DESCRIPTION from "./write.txt";
import type { SandboxAgentToolDefinition } from "./types";

const writeArgumentsSchema = z
  .object({
    content: z.string(),
    path: z.string(),
  })
  .strict();

type WriteSandboxAgentToolResult = {
  path: string;
  session: SandboxSession;
};

type WriteSandboxAgentToolArguments = z.infer<typeof writeArgumentsSchema>;

export const writeSandboxAgentTool = {
  description: DESCRIPTION,
  async execute(args, context) {
    const parsedArguments = writeArgumentsSchema.parse(args);

    return writeSandboxFile({
      content: parsedArguments.content,
      path: parsedArguments.path,
      sessionId: context.sessionId,
    });
  },
  id: "write_file",
  parameters: {
    additionalProperties: false,
    properties: {
      content: {
        description: "Complete final file contents to write.",
        type: "string",
      },
      path: {
        description: "Repository-relative file path to overwrite.",
        type: "string",
      },
    },
    required: ["path", "content"],
    type: "object",
  },
} satisfies SandboxAgentToolDefinition<
  WriteSandboxAgentToolArguments,
  WriteSandboxAgentToolResult
>;
