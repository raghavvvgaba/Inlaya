import "server-only";

import type { AIToolDefinition } from "~/server/ai/types";

import { listSandboxAgentTools } from "./registry";

export function buildSandboxAgentModelTools(): AIToolDefinition[] {
  return listSandboxAgentTools().map((tool) => ({
    function: {
      description: tool.description,
      name: tool.id,
      parameters: tool.parameters,
    },
    type: "function",
  }));
}
