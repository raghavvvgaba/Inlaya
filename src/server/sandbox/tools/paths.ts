import "server-only";

const BLOCKED_PATH_PARTS = new Set([
  ".git",
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
]);

export function normalizeSandboxRelativePath(path: string | null | undefined, options: { allowRoot?: boolean } = {}) {
  const allowRoot = options.allowRoot ?? false;
  const rawPath = path?.trim() ?? "";

  if (!rawPath) {
    if (allowRoot) return "";
    throw new Error("missing_path");
  }

  if (rawPath.startsWith("/") || rawPath.startsWith("\\")) {
    throw new Error("invalid_path");
  }

  const parts = rawPath
    .replaceAll("\\", "/")
    .split("/")
    .filter((part) => part && part !== ".");

  if (parts.length === 0) {
    if (allowRoot) return "";
    throw new Error("invalid_path");
  }

  if (parts.some((part) => part === ".." || BLOCKED_PATH_PARTS.has(part))) {
    throw new Error("invalid_path");
  }

  return parts.join("/");
}

export function toSandboxRepoPath(relativePath: string) {
  return relativePath ? `/home/user/repo/${relativePath}` : "/home/user/repo";
}

export function shouldHideSandboxEntry(name: string) {
  return BLOCKED_PATH_PARTS.has(name) || name === ".DS_Store";
}
