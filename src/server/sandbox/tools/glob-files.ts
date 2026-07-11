import "server-only";

/** Implements the app-owned glob_files sandbox tool. */

import { z } from "zod";

import { sandboxProvider } from "~/server/sandbox/provider";
import {
  normalizeSandboxRelativePath,
  toSandboxRepoPath,
} from "~/server/sandbox/tools/paths";
import type { SandboxAgentToolDefinition } from "~/server/sandbox/tools/types";
import type {
  SandboxCommandResult,
  SandboxGlobInput,
  SandboxGlobResult,
} from "~/server/sandbox/types";

import DESCRIPTION from "./glob.txt";

export const SANDBOX_GLOB_CAP = 100;

function quoteForShell(value: string) {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

export function normalizeGlobPatterns(patterns: string[]) {
  if (patterns.length === 0) {
    throw new Error("missing_patterns");
  }

  const normalizedPatterns = patterns.map((pattern) => pattern.trim());

  if (normalizedPatterns.some((pattern) => !pattern)) {
    throw new Error("invalid_pattern");
  }

  return normalizedPatterns;
}

export function buildGlobCommand(
  input: Pick<SandboxGlobInput, "path" | "patterns">,
) {
  const normalizedPath = normalizeSandboxRelativePath(input.path, {
    allowRoot: true,
  });
  const repoPath = toSandboxRepoPath(normalizedPath);
  const globArguments = input.patterns.map(
    (pattern) => `-g ${quoteForShell(pattern)}`,
  );

  return [
    "set -o pipefail;",
    "rg",
    "--files",
    "--sort path",
    ...globArguments,
    "-g '!**/.git/**'",
    "-g '!**/.next/**'",
    "-g '!**/.turbo/**'",
    "-g '!**/coverage/**'",
    "-g '!**/dist/**'",
    "-g '!**/node_modules/**'",
    `-- ${quoteForShell(repoPath)}`,
    `| sed -n '1,${SANDBOX_GLOB_CAP + 1}p'`,
  ].join(" ");
}

export function buildGlobResult(
  commandResult: Pick<SandboxCommandResult, "exitCode" | "stderr" | "stdout">,
): SandboxGlobResult {
  if (commandResult.exitCode && ![0, 1].includes(commandResult.exitCode)) {
    throw new Error(commandResult.stderr.trim() || "glob_failed");
  }

  const paths = commandResult.stdout
    .split("\n")
    .map((path) => path.trim())
    .filter(Boolean)
    .map((path) =>
      path.startsWith("/home/user/repo/")
        ? path.slice("/home/user/repo/".length)
        : path,
    )
    .sort();

  return {
    cap: SANDBOX_GLOB_CAP,
    paths: paths.slice(0, SANDBOX_GLOB_CAP),
    truncated: paths.length > SANDBOX_GLOB_CAP,
  };
}

export async function globSandboxFiles(
  input: SandboxGlobInput,
): Promise<SandboxGlobResult> {
  const patterns = normalizeGlobPatterns(input.patterns);
  const result = await sandboxProvider.runRawCommand({
    command: buildGlobCommand({
      path: input.path ?? "",
      patterns,
    }),
    sessionId: input.sessionId,
  });

  return buildGlobResult(result);
}

const globArgumentsSchema = z
  .object({
    path: z.string().optional(),
    patterns: z.array(z.string()).min(1),
  })
  .strict();

type GlobSandboxAgentToolArguments = z.infer<typeof globArgumentsSchema>;

export const globSandboxAgentTool = {
  description: DESCRIPTION,
  async execute(args, context) {
    const parsedArguments = globArgumentsSchema.parse(args);

    return globSandboxFiles({
      path: parsedArguments.path ?? "",
      patterns: parsedArguments.patterns,
      sessionId: context.sessionId,
    });
  },
  id: "glob_files",
  parameters: {
    additionalProperties: false,
    properties: {
      path: {
        description: "Optional repository-relative directory to inspect.",
        type: "string",
      },
      patterns: {
        description:
          "Ripgrep glob patterns. Use leading ! for exclusions.",
        items: { type: "string" },
        minItems: 1,
        type: "array",
      },
    },
    required: ["patterns"],
    type: "object",
  },
} satisfies SandboxAgentToolDefinition<
  GlobSandboxAgentToolArguments,
  SandboxGlobResult
>;
