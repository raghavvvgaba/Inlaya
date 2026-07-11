import { beforeEach, describe, expect, it, vi } from "vitest";

const { runRawCommandMock } = vi.hoisted(() => ({
  runRawCommandMock: vi.fn(),
}));

vi.mock("~/server/sandbox/provider", () => ({
  sandboxProvider: {
    runRawCommand: runRawCommandMock,
  },
}));

import {
  buildSearchCommand,
  buildSearchResult,
  normalizeSearchIncludes,
  normalizeSearchQuery,
  parseSearchMatches,
  searchSandboxCode,
  SANDBOX_SEARCH_TOTAL_CAP,
} from "../search-code";

function createMatchEvent({
  columnStart = 0,
  line,
  path,
  text,
}: {
  columnStart?: number;
  line: number;
  path: string;
  text: string;
}) {
  return JSON.stringify({
    data: {
      line_number: line,
      lines: { text: `${text}\n` },
      path: { text: path },
      submatches: [{ start: columnStart }],
    },
    type: "match",
  });
}

beforeEach(() => {
  runRawCommandMock.mockReset();
});

describe("normalizeSearchQuery", () => {
  it("trims a valid query", () => {
    expect(normalizeSearchQuery("  useState  ")).toBe("useState");
  });

  it("throws for an empty query", () => {
    expect(() => normalizeSearchQuery("   ")).toThrow("missing_query");
  });
});

describe("normalizeSearchIncludes", () => {
  it("trims include patterns", () => {
    expect(normalizeSearchIncludes([" **/*.tsx ", " !**/*.test.tsx "])).toEqual([
      "**/*.tsx",
      "!**/*.test.tsx",
    ]);
  });

  it("returns an empty list when include is omitted", () => {
    expect(normalizeSearchIncludes(undefined)).toEqual([]);
  });

  it("rejects blank include patterns", () => {
    expect(() => normalizeSearchIncludes([" "])).toThrow(
      "invalid_include_pattern",
    );
  });
});

describe("buildSearchCommand", () => {
  it("builds a root search command", () => {
    const command = buildSearchCommand({
      path: "",
      query: "useState",
    });

    expect(command).toContain("rg");
    expect(command).toContain("--json");
    expect(command).toContain("--fixed-strings");
    expect(command).toContain("--smart-case");
    expect(command).toContain("-e 'useState'");
    expect(command).toContain("-- '/home/user/repo'");
  });

  it("normalizes the path and shell-quotes apostrophes in the query", () => {
    const command = buildSearchCommand({
      path: "./src//components",
      query: "it's broken",
    });

    expect(command).toContain("-- '/home/user/repo/src/components'");
    expect(command).toContain("-e 'it'\\''s broken'");
  });

  it("adds shell-quoted include and exclude patterns", () => {
    const command = buildSearchCommand({
      include: ["src/**/*.tsx", "!**/*.test.tsx", "**/owner's.tsx"],
      path: "",
      query: "Button",
    });

    expect(command).toContain("-g 'src/**/*.tsx'");
    expect(command).toContain("-g '!**/*.test.tsx'");
    expect(command).toContain("-g '**/owner'\\''s.tsx'");
  });

  it("uses regex mode without fixed-string matching", () => {
    const command = buildSearchCommand({
      path: "",
      query: "use(State|Effect)",
      regex: true,
    });

    expect(command).not.toContain("--fixed-strings");
    expect(command).toContain("-e 'use(State|Effect)'");
    expect(command).toContain("--smart-case");
  });
});

describe("parseSearchMatches", () => {
  it("parses repo-relative matches with one-based columns", () => {
    const stdout = [
      JSON.stringify({ type: "begin" }),
      createMatchEvent({
        columnStart: 4,
        line: 12,
        path: "/home/user/repo/src/app/page.tsx",
        text: "const value = useState()",
      }),
    ].join("\n");

    expect(parseSearchMatches(stdout)).toEqual({
      matches: [
        {
          column: 5,
          line: 12,
          path: "src/app/page.tsx",
          text: "const value = useState()",
        },
      ],
      truncated: false,
    });
  });

  it("marks results truncated when the total cap is reached", () => {
    const stdout = Array.from({ length: SANDBOX_SEARCH_TOTAL_CAP + 2 }, (_, index) =>
      createMatchEvent({
        line: index + 1,
        path: `/home/user/repo/src/file-${index}.ts`,
        text: `match ${index + 1}`,
      }),
    ).join("\n");

    const result = parseSearchMatches(stdout);

    expect(result.matches).toHaveLength(SANDBOX_SEARCH_TOTAL_CAP);
    expect(result.truncated).toBe(true);
  });

  it("marks results truncated when one file reaches the per-file cap", () => {
    const stdout = [
      createMatchEvent({
        line: 1,
        path: "/home/user/repo/src/app/page.tsx",
        text: "first match",
      }),
      createMatchEvent({
        line: 2,
        path: "/home/user/repo/src/app/page.tsx",
        text: "second match",
      }),
    ].join("\n");

    const result = parseSearchMatches(stdout);

    expect(result.matches).toHaveLength(2);
    expect(result.truncated).toBe(true);
  });
});

describe("buildSearchResult", () => {
  it("returns an empty non-truncated result for ripgrep exit code 1", () => {
    expect(
      buildSearchResult({
        exitCode: 1,
        stderr: "",
        stdout: "",
      }),
    ).toEqual({
      caps: {
        perFile: 2,
        total: 10,
      },
      matches: [],
      truncated: false,
    });
  });

  it("throws stderr for non-search exit failures", () => {
    expect(() =>
      buildSearchResult({
        exitCode: 2,
        stderr: "permission denied",
        stdout: "",
      }),
    ).toThrow("permission denied");
  });
});

describe("searchSandboxCode", () => {
  it("runs the provider command and returns the parsed search result", async () => {
    runRawCommandMock.mockResolvedValue({
      command: "rg ...",
      exitCode: 0,
      stderr: "",
      stdout: createMatchEvent({
        columnStart: 2,
        line: 8,
        path: "/home/user/repo/src/app/page.tsx",
        text: "const count = useState(0)",
      }),
    });

    const result = await searchSandboxCode({
      include: ["src/**/*.tsx"],
      path: "",
      query: "useState",
      regex: false,
      sessionId: "session-test",
    });

    expect(runRawCommandMock).toHaveBeenCalledWith({
      command: expect.stringMatching(
        /-g 'src\/\*\*\/\*\.tsx'.*-e 'useState'/,
      ),
      sessionId: "session-test",
    });
    expect(result).toEqual({
      caps: {
        perFile: 2,
        total: 10,
      },
      matches: [
        {
          column: 3,
          line: 8,
          path: "src/app/page.tsx",
          text: "const count = useState(0)",
        },
      ],
      truncated: false,
    });
  });
});
