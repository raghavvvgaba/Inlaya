import { describe, expect, it } from "vitest";

import { parseSandboxAgentMode } from "../agent-mode";

describe("parseSandboxAgentMode", () => {
  it("defaults missing mode to build", () => {
    expect(parseSandboxAgentMode(undefined)).toBe("build");
  });

  it("accepts ask and build", () => {
    expect(parseSandboxAgentMode("ask")).toBe("ask");
    expect(parseSandboxAgentMode("build")).toBe("build");
  });

  it("maps the legacy plan value to ask", () => {
    expect(parseSandboxAgentMode("plan")).toBe("ask");
  });

  it("rejects invalid modes", () => {
    expect(parseSandboxAgentMode("auto")).toBeNull();
    expect(parseSandboxAgentMode(null)).toBeNull();
  });
});
