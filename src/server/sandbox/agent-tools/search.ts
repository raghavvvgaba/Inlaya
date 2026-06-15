import "server-only";

import { z } from "zod";

import { searchSandboxCode } from "~/server/sandbox/tools/search-code";
import type { SandboxSearchResult } from "~/server/sandbox/types";

import DESCRIPTION from "./search.txt";
import type { SandboxAgentToolDefinition } from "./types";

const searchArgumentsSchema = z
  .object({
    path: z.string().optional(),
    query: z.string(),
  })
  .strict();

type SearchSandboxAgentToolArguments = z.infer<typeof searchArgumentsSchema>;

export const searchSandboxAgentTool = {
  description: DESCRIPTION,
  async execute(args, context) {
    const parsedArguments = searchArgumentsSchema.parse(args);

    return searchSandboxCode({
      path: parsedArguments.path ?? "",
      query: parsedArguments.query,
      sessionId: context.sessionId,
    });
  },
  id: "search_code",
  parameters: {
    additionalProperties: false,
    properties: {
      path: {
        description: "Optional repository-relative path to limit the search.",
        type: "string",
      },
      query: {
        description: "Literal text to search for.",
        type: "string",
      },
    },
    required: ["query"],
    type: "object",
  },
} satisfies SandboxAgentToolDefinition<
  SearchSandboxAgentToolArguments,
  SandboxSearchResult
>;
