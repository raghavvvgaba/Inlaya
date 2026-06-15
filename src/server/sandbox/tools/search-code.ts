import "server-only";

/** Implements the app-owned search_code sandbox tool. */

import { z } from "zod";

import { PROJECT_DIR } from "~/server/sandbox/providers/e2b/constants";
import { sandboxProvider } from "~/server/sandbox/provider";
import {
  normalizeSandboxRelativePath,
  toSandboxRepoPath,
} from "~/server/sandbox/tools/paths";
import type { SandboxAgentToolDefinition } from "~/server/sandbox/tools/types";
import type {
  SandboxCommandResult,
  SandboxSearchInput,
  SandboxSearchMatch,
  SandboxSearchResult,
} from "~/server/sandbox/types";

import DESCRIPTION from "./search.txt";

export const SANDBOX_SEARCH_TOTAL_CAP = 10;
export const SANDBOX_SEARCH_PER_FILE_CAP = 2;

type RipgrepJsonLine = {
  type?: string;
  data?: {
    line_number?: number;
    lines?: RipgrepTextValue;
    path?: RipgrepTextValue;
    submatches?: Array<{
      start?: number;
    }>;
  };
};

type RipgrepTextValue = {
  bytes?: string;
  text?: string;
};

function quoteForShell(value: string) {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function readRipgrepTextValue(value: RipgrepTextValue | undefined) {
  if (!value) {
    return "";
  }

  if (typeof value.text === "string") {
    return value.text;
  }

  if (typeof value.bytes === "string") {
    return Buffer.from(value.bytes, "base64").toString("utf8");
  }

  return "";
}

function toRelativeSandboxPath(path: string) {
  if (path === PROJECT_DIR) {
    return "";
  }

  return path.startsWith(`${PROJECT_DIR}/`)
    ? path.slice(PROJECT_DIR.length + 1)
    : path;
}

export function normalizeSearchQuery(query: string) {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    throw new Error("missing_query");
  }

  return normalizedQuery;
}

export function buildSearchCommand(
  input: Pick<SandboxSearchInput, "path" | "query">,
) {
  const normalizedPath = normalizeSandboxRelativePath(input.path, {
    allowRoot: true,
  });
  const repoPath = toSandboxRepoPath(normalizedPath);

  return [
    "rg",
    "--json",
    "--line-number",
    "--column",
    "--fixed-strings",
    "--smart-case",
    `--max-count ${SANDBOX_SEARCH_PER_FILE_CAP}`,
    "-g '!**/.git/**'",
    "-g '!**/.next/**'",
    "-g '!**/.turbo/**'",
    "-g '!**/coverage/**'",
    "-g '!**/dist/**'",
    "-g '!**/node_modules/**'",
    `-e ${quoteForShell(input.query)}`,
    `-- ${quoteForShell(repoPath)}`,
  ].join(" ");
}

export function parseSearchMatches(stdout: string) {
  const matches: SandboxSearchMatch[] = [];
  const perFileCounts = new Map<string, number>();

  for (const line of stdout.split("\n")) {
    if (!line.trim()) {
      continue;
    }

    const event = JSON.parse(line) as RipgrepJsonLine;

    if (event.type !== "match" || !event.data) {
      continue;
    }

    const path = toRelativeSandboxPath(readRipgrepTextValue(event.data.path));
    const text = readRipgrepTextValue(event.data.lines).replace(/\r?\n$/, "");
    const lineNumber = event.data.line_number ?? 0;
    const column = (event.data.submatches?.[0]?.start ?? 0) + 1;

    matches.push({
      column,
      line: lineNumber,
      path,
      text,
    });
    perFileCounts.set(path, (perFileCounts.get(path) ?? 0) + 1);

    if (matches.length >= SANDBOX_SEARCH_TOTAL_CAP) {
      break;
    }
  }

  const truncated =
    matches.length >= SANDBOX_SEARCH_TOTAL_CAP ||
    Array.from(perFileCounts.values()).some(
      (count) => count >= SANDBOX_SEARCH_PER_FILE_CAP,
    );

  return {
    matches,
    truncated,
  };
}

export function buildSearchResult(
  commandResult: Pick<SandboxCommandResult, "exitCode" | "stderr" | "stdout">,
): SandboxSearchResult {
  if (commandResult.exitCode && ![0, 1].includes(commandResult.exitCode)) {
    throw new Error(commandResult.stderr.trim() || "search_failed");
  }

  const parsed = parseSearchMatches(commandResult.stdout);

  return {
    caps: {
      perFile: SANDBOX_SEARCH_PER_FILE_CAP,
      total: SANDBOX_SEARCH_TOTAL_CAP,
    },
    matches: parsed.matches,
    truncated: commandResult.exitCode === 1 ? false : parsed.truncated,
  };
}

/** Runs ripgrep in the sandbox repo and returns capped single-line matches. */
export async function searchSandboxCode(
  input: SandboxSearchInput,
): Promise<SandboxSearchResult> {
  const query = normalizeSearchQuery(input.query);

  const result = await sandboxProvider.runRawCommand({
    command: buildSearchCommand({
      ...input,
      path: input.path ?? "",
      query,
    }),
    sessionId: input.sessionId,
  });

  return buildSearchResult(result);
}

const searchArgumentsSchema = z
  .object({
    path: z.string().optional(),
    query: z.string(),
  })
  .strict();

type SearchSandboxAgentToolArguments = z.infer<typeof searchArgumentsSchema>;

export const searchSandboxAgentTool = {
  description: DESCRIPTION,
  async execute(args, context) {
    const parsedArguments = searchArgumentsSchema.parse(args);

    return searchSandboxCode({
      path: parsedArguments.path ?? "",
      query: parsedArguments.query,
      sessionId: context.sessionId,
    });
  },
  id: "search_code",
  parameters: {
    additionalProperties: false,
    properties: {
      path: {
        description: "Optional repository-relative path to limit the search.",
        type: "string",
      },
      query: {
        description: "Literal text to search for.",
        type: "string",
      },
    },
    required: ["query"],
    type: "object",
  },
} satisfies SandboxAgentToolDefinition<
  SearchSandboxAgentToolArguments,
  SandboxSearchResult
>;
