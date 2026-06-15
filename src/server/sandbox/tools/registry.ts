import "server-only";

import type { SandboxAgentToolDefinition } from "./types";
import { listSandboxAgentTool } from "./list-directory";
import { readSandboxAgentTool } from "./read-file";
import { searchSandboxAgentTool } from "./search-code";
import { writeSandboxAgentTool } from "./write-file";

export const sandboxAgentToolRegistry = [
  listSandboxAgentTool,
  readSandboxAgentTool,
  searchSandboxAgentTool,
  writeSandboxAgentTool,
] as const satisfies readonly SandboxAgentToolDefinition[];

export type SandboxAgentToolName =
  (typeof sandboxAgentToolRegistry)[number]["id"];

export const sandboxAgentToolsByName = new Map<
  SandboxAgentToolName,
  (typeof sandboxAgentToolRegistry)[number]
>(sandboxAgentToolRegistry.map((tool) => [tool.id, tool]));

export function getSandboxAgentTool(
  name: SandboxAgentToolName,
): SandboxAgentToolDefinition | undefined {
  return sandboxAgentToolsByName.get(name);
}

export function listSandboxAgentTools() {
  return sandboxAgentToolRegistry;
}
