import type { SandboxAgentMode } from "~/server/sandbox/types";

export function parseSandboxAgentMode(value: unknown): SandboxAgentMode | null {
  if (value === undefined) {
    return "plan";
  }

  return value === "plan" || value === "build" ? value : null;
}
