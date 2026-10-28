import { describe, expect, it } from "vitest";

import {
  AGENT_MODELS,
  buildModelReasoningRequestConfig,
  DEFAULT_AGENT_MODEL,
  getModelReasoningRequestConfig,
  supportsStrictToolArguments,
  toOpenRouterModelId,
} from "~/lib/agent-models";

describe("agent model mappings", () => {
  it("maps every selectable model to its OpenRouter model ID", () => {
    expect(
      Object.fromEntries(
        AGENT_MODELS.map(({ id }) => [id, toOpenRouterModelId(id)]),
      ),
    ).toEqual({
      "deepseek-v4-flash": "deepseek/deepseek-v4-flash",
      "deepseek-v4-pro": "deepseek/deepseek-v4-pro",
      "glm-5.1": "z-ai/glm-5.1",
      "glm-5.2": "z-ai/glm-5.2",
      "kimi-k2.6": "moonshotai/kimi-k2.6",
      "kimi-k2.7-code": "moonshotai/kimi-k2.7-code",
      "mimo-v2.5": "xiaomi/mimo-v2.5",
      "mimo-v2.5-pro": "xiaomi/mimo-v2.5-pro",
    });
  });

  it("keeps the default model selectable and mapped", () => {
    expect(AGENT_MODELS.some(({ id }) => id === DEFAULT_AGENT_MODEL)).toBe(true);
    expect(toOpenRouterModelId(DEFAULT_AGENT_MODEL)).toBe(
      "moonshotai/kimi-k2.7-code",
    );
  });

  it("declares strict tool-argument support for every selectable model", () => {
    expect(
      AGENT_MODELS.map(({ id, openRouterId, supportsStrictToolArguments }) => ({
        id,
        openRouterId,
        supportsStrictToolArguments,
      })),
    ).toEqual(
      AGENT_MODELS.map(({ id, openRouterId }) => ({
        id,
        openRouterId,
        supportsStrictToolArguments: true,
      })),
    );

    for (const model of AGENT_MODELS) {
      expect(supportsStrictToolArguments(model.id)).toBe(true);
      expect(supportsStrictToolArguments(model.openRouterId)).toBe(true);
    }
  });

  it("defaults unknown models to non-strict tool arguments", () => {
    expect(supportsStrictToolArguments("vendor/unknown-model")).toBe(false);
  });

  it("matches OpenRouter reasoning capabilities for selectable models", () => {
    expect(
      Object.fromEntries(
        AGENT_MODELS.map(({ id, reasoning }) => [id, reasoning]),
      ),
    ).toEqual({
      "deepseek-v4-flash": {
        defaultEnabled: false,
        mandatory: false,
        supported: true,
      },
      "deepseek-v4-pro": {
        defaultEnabled: false,
        mandatory: false,
        supported: true,
      },
      "glm-5.1": {
        defaultEnabled: true,
        mandatory: false,
        supported: true,
      },
      "glm-5.2": {
        defaultEnabled: true,
        mandatory: false,
        supported: true,
      },
      "kimi-k2.6": {
        defaultEnabled: true,
        mandatory: false,
        supported: true,
      },
      "kimi-k2.7-code": {
        defaultEnabled: true,
        mandatory: true,
        supported: true,
      },
      "mimo-v2.5": {
        defaultEnabled: false,
        mandatory: false,
        supported: true,
      },
      "mimo-v2.5-pro": {
        defaultEnabled: false,
        mandatory: false,
        supported: true,
      },
    });
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

    expect(getModelReasoningRequestConfig("deepseek-v4-pro")).toEqual({
      enabled: true,
      exclude: false,
    });
    expect(
      getModelReasoningRequestConfig("moonshotai/kimi-k2.7-code"),
    ).toBeUndefined();
    expect(
      getModelReasoningRequestConfig("vendor/unknown-model"),
    ).toBeUndefined();
  });

  it("preserves an already-qualified custom OpenRouter model ID", () => {
    expect(toOpenRouterModelId("anthropic/claude-opus-5")).toBe(
      "anthropic/claude-opus-5",
    );
  });
});
