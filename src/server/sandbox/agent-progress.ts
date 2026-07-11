export type SandboxAgentProgressEvent = {
  message: string;
  type: "progress";
};

export type SandboxAgentProgressHandler = (
  event: SandboxAgentProgressEvent,
) => Promise<void> | void;

const MACHINE_PROTOCOL_PATTERNS = [
  /"tool_calls"/i,
  /"function"/i,
  /"arguments"/i,
  /<tool[_-]?call/i,
  /<\/tool[_-]?call>/i,
];

export function shouldShowModelProgressText(text: string) {
  const normalized = text.trim();

  if (!normalized || normalized.length > 500) {
    return false;
  }

  if (
    (normalized.startsWith("{") && normalized.endsWith("}")) ||
    (normalized.startsWith("[") && normalized.endsWith("]"))
  ) {
    return false;
  }

  return !MACHINE_PROTOCOL_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function buildToolProgressMessage(
  toolName: string,
  argumentsValue: Record<string, unknown>,
) {
  const path =
    typeof argumentsValue.path === "string" && argumentsValue.path.trim()
      ? argumentsValue.path.trim()
      : undefined;

  switch (toolName) {
    case "glob_files":
      return path ? `Finding files in ${path}...` : "Finding project files...";
    case "search_code":
      return "Searching the codebase...";
    case "list_directory":
      return path ? `Inspecting ${path}...` : "Inspecting project files...";
    case "read_file":
      return path ? `Reading ${path}...` : "Reading a file...";
    case "replace_in_file":
    case "write_file":
      return path ? `Editing ${path}...` : "Editing a file...";
    default:
      return "Working in the sandbox...";
  }
}
