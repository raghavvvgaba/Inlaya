import "server-only";

import { listSandboxAgentTool } from "./list";
import { readSandboxAgentTool } from "./read";
import { searchSandboxAgentTool } from "./search";
import type { SandboxAgentToolDefinition } from "./types";
import { writeSandboxAgentTool } from "./write";

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
