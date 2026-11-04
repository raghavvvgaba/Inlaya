import { describe, expect, it } from "vitest";

import {
  buildModelReasoningRequestConfig,
  DEFAULT_AGENT_MODEL,
  getAgentModelLabel,
  getModelReasoningRequestConfig,
  resolveAgentModel,
  supportsStrictToolArguments,
} from "~/lib/agent-models";

describe("agent model configuration", () => {
  it("defaults to GLM-5.3 when no model is configured", () => {
    expect(DEFAULT_AGENT_MODEL).toBe("z-ai/glm-5.3");
    expect(resolveAgentModel(undefined)).toBe("z-ai/glm-5.3");
    expect(resolveAgentModel("  ")).toBe("z-ai/glm-5.3");
  });

  it("uses the env-configured model as-is", () => {
    expect(resolveAgentModel("anthropic/claude-opus-5")).toBe(
      "anthropic/claude-opus-5",
    );
  });

  it("labels the known model and falls back to the raw ID", () => {
    expect(getAgentModelLabel("z-ai/glm-5.3")).toBe("GLM-5.3");
    expect(getAgentModelLabel("vendor/unknown-model")).toBe(
      "vendor/unknown-model",
    );
  });

  it("enables strict tool arguments only for verified models", () => {
    expect(supportsStrictToolArguments("z-ai/glm-5.3")).toBe(true);
    expect(supportsStrictToolArguments("vendor/unknown-model")).toBe(false);
  });

  it("only enables reasoning when a supported model defaults it off", () => {
    expect(
      buildModelReasoningRequestConfig({
        defaultEnabled: false,
        mandatory: false,
        supported: true,
      }),
    ).toEqual({ enabled: true, exclude: false });
    expect(
      buildModelReasoningRequestConfig({
        defaultEnabled: true,
        mandatory: false,
        supported: true,
      }),
    ).toBeUndefined();
    expect(
      buildModelReasoningRequestConfig({
        defaultEnabled: true,
        mandatory: true,
        supported: true,
      }),
    ).toBeUndefined();
    expect(
      buildModelReasoningRequestConfig({ supported: false }),
    ).toBeUndefined();
    expect(buildModelReasoningRequestConfig(undefined)).toBeUndefined();

    expect(getModelReasoningRequestConfig("z-ai/glm-5.3")).toBeUndefined();
    expect(
      getModelReasoningRequestConfig("vendor/unknown-model"),
    ).toBeUndefined();
  });
});
