import "server-only";

export type SandboxAgentToolContext = {
  sessionId: string;
};

export type SandboxAgentToolDefinition<
  TArguments extends Record<string, unknown> = Record<string, unknown>,
  TResult = unknown,
> = {
  description: string;
  execute(arguments_: TArguments, context: SandboxAgentToolContext): Promise<TResult>;
  id: string;
  parameters: Record<string, unknown>;
};
