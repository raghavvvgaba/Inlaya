import "server-only";

export const ALLOWED_SANDBOX_COMMANDS = new Set(["git diff", "git diff -- .", "git status"]);

export function normalizeSandboxCommand(command: string | null | undefined) {
  const normalizedCommand = command?.trim().replace(/\s+/g, " ") ?? "";

  if (!ALLOWED_SANDBOX_COMMANDS.has(normalizedCommand)) {
    throw new Error("command_not_allowed");
  }

  return normalizedCommand;
}
