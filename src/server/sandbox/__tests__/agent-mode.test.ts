import { describe, expect, it } from "vitest";

import { parseSandboxAgentMode } from "../agent-mode";

describe("parseSandboxAgentMode", () => {
  it("defaults missing mode to plan", () => {
    expect(parseSandboxAgentMode(undefined)).toBe("plan");
  });

  it("accepts plan and build", () => {
    expect(parseSandboxAgentMode("plan")).toBe("plan");
    expect(parseSandboxAgentMode("build")).toBe("build");
  });

  it("rejects invalid modes", () => {
    expect(parseSandboxAgentMode("auto")).toBeNull();
    expect(parseSandboxAgentMode(null)).toBeNull();
  });
});
