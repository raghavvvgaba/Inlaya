export type ModelReasoningCapabilities =
  | { supported: false }
  | {
      defaultEnabled: boolean;
      mandatory: boolean;
      supported: true;
    };

export type ModelReasoningRequestConfig = {
  enabled: true;
  exclude: false;
};

type KnownModelCapabilities = {
  label: string;
  reasoning: ModelReasoningCapabilities;
  supportsStrictToolArguments: boolean;
};

// The agent model is configured through `OPENROUTER_MODEL` (an OpenRouter
// model ID). This is the fallback when the env var is unset.
export const DEFAULT_AGENT_MODEL = "z-ai/glm-5.3";

// Capabilities for models we've verified against OpenRouter's `/api/v1/models`
// metadata (last checked 2026-11-05). Any other model set through env falls
// back to non-strict tool arguments and the provider's default reasoning.
const KNOWN_MODELS: Record<string, KnownModelCapabilities> = {
  "z-ai/glm-5.3": {
    label: "GLM-5.3",
    reasoning: { defaultEnabled: true, mandatory: true, supported: true },
    supportsStrictToolArguments: true,
  },
};

export function resolveAgentModel(configured: string | undefined): string {
  return configured?.trim() || DEFAULT_AGENT_MODEL;
}

export function getAgentModelLabel(id: string): string {
  return KNOWN_MODELS[id]?.label ?? id;
}

export function supportsStrictToolArguments(id: string): boolean {
  return KNOWN_MODELS[id]?.supportsStrictToolArguments ?? false;
}

export function buildModelReasoningRequestConfig(
  capabilities: ModelReasoningCapabilities | undefined,
): ModelReasoningRequestConfig | undefined {
  if (
    !capabilities?.supported ||
    capabilities.mandatory ||
    capabilities.defaultEnabled
  ) {
    return undefined;
  }

  return { enabled: true, exclude: false };
}

export function getModelReasoningRequestConfig(
  id: string,
): ModelReasoningRequestConfig | undefined {
  return buildModelReasoningRequestConfig(KNOWN_MODELS[id]?.reasoning);
}
