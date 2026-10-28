import type { SandboxAgentMode } from "~/server/sandbox/types";

export function parseSandboxAgentMode(value: unknown): SandboxAgentMode | null {
  if (value === undefined) {
    return "build";
  }

  if (value === "plan") {
    return "ask";
  }

  return value === "ask" || value === "build" ? value : null;
}
