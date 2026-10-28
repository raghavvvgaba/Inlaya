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

// Verified against OpenRouter's `/api/v1/models` metadata on 2026-09-01.
// When adding a model, verify `tools`, `structured_outputs`, and `reasoning` and
// declare the capabilities here.
export const AGENT_MODELS = [
  {
    id: "glm-5.2",
    label: "GLM-5.2",
    openRouterId: "z-ai/glm-5.2",
    reasoning: { defaultEnabled: true, mandatory: false, supported: true },
    supportsStrictToolArguments: true,
  },
  {
    id: "glm-5.1",
    label: "GLM-5.1",
    openRouterId: "z-ai/glm-5.1",
    reasoning: { defaultEnabled: true, mandatory: false, supported: true },
    supportsStrictToolArguments: true,
  },
  {
    id: "kimi-k2.7-code",
    label: "Kimi K2.7 Code",
    openRouterId: "moonshotai/kimi-k2.7-code",
    reasoning: { defaultEnabled: true, mandatory: true, supported: true },
    supportsStrictToolArguments: true,
  },
  {
    id: "kimi-k2.6",
    label: "Kimi K2.6",
    openRouterId: "moonshotai/kimi-k2.6",
    reasoning: { defaultEnabled: true, mandatory: false, supported: true },
    supportsStrictToolArguments: true,
  },
  {
    id: "deepseek-v4-pro",
    label: "DeepSeek V4 Pro",
    openRouterId: "deepseek/deepseek-v4-pro",
    reasoning: { defaultEnabled: false, mandatory: false, supported: true },
    supportsStrictToolArguments: true,
  },
  {
    id: "deepseek-v4-flash",
    label: "DeepSeek V4 Flash",
    openRouterId: "deepseek/deepseek-v4-flash",
    reasoning: { defaultEnabled: false, mandatory: false, supported: true },
    supportsStrictToolArguments: true,
  },
  {
    id: "mimo-v2.5",
    label: "MiMo-V2.5",
    openRouterId: "xiaomi/mimo-v2.5",
    reasoning: { defaultEnabled: false, mandatory: false, supported: true },
    supportsStrictToolArguments: true,
  },
  {
    id: "mimo-v2.5-pro",
    label: "MiMo-V2.5-Pro",
    openRouterId: "xiaomi/mimo-v2.5-pro",
    reasoning: { defaultEnabled: false, mandatory: false, supported: true },
    supportsStrictToolArguments: true,
  },
] as const;

export const DEFAULT_AGENT_MODEL = "kimi-k2.7-code";

export type AgentModelId = (typeof AGENT_MODELS)[number]["id"];

const AGENT_MODEL_IDS = new Set<string>(AGENT_MODELS.map((m) => m.id));

export function isAgentModelId(value: unknown): value is AgentModelId {
  return typeof value === "string" && AGENT_MODEL_IDS.has(value);
}

export function getAgentModelLabel(id: string): string {
  return AGENT_MODELS.find((m) => m.id === id)?.label ?? id;
}

export function toOpenRouterModelId(id: string): string {
  return AGENT_MODELS.find((model) => model.id === id)?.openRouterId ?? id;
}

export function supportsStrictToolArguments(id: string): boolean {
  return (
    AGENT_MODELS.find(
      (model) => model.id === id || model.openRouterId === id,
    )?.supportsStrictToolArguments ?? false
  );
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
  const capabilities = AGENT_MODELS.find(
    (model) => model.id === id || model.openRouterId === id,
  )?.reasoning;

  return buildModelReasoningRequestConfig(capabilities);
}
