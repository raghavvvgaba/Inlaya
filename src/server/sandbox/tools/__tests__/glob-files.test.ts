import { beforeEach, describe, expect, it, vi } from "vitest";

const { runRawCommandMock } = vi.hoisted(() => ({
  runRawCommandMock: vi.fn(),
}));

vi.mock("~/server/sandbox/provider", () => ({
  sandboxProvider: { runRawCommand: runRawCommandMock },
}));

import {
  buildGlobCommand,
  buildGlobResult,
  globSandboxFiles,
  normalizeGlobPatterns,
  SANDBOX_GLOB_CAP,
} from "../glob-files";

beforeEach(() => runRawCommandMock.mockReset());

describe("normalizeGlobPatterns", () => {
  it("trims patterns", () => {
    expect(normalizeGlobPatterns([" src/**/*.tsx ", " !**/*.test.tsx "])).toEqual([
      "src/**/*.tsx",
      "!**/*.test.tsx",
    ]);
  });

  it("rejects missing or blank patterns", () => {
    expect(() => normalizeGlobPatterns([])).toThrow("missing_patterns");
    expect(() => normalizeGlobPatterns([" "])).toThrow("invalid_pattern");
  });
});

describe("buildGlobCommand", () => {
  it("builds a bounded root command with include and exclude globs", () => {
    const command = buildGlobCommand({
      path: "",
      patterns: ["src/**/*.tsx", "!**/*.test.tsx"],
    });

    expect(command).toContain("rg --files --sort path");
    expect(command).toContain("-g 'src/**/*.tsx'");
    expect(command).toContain("-g '!**/*.test.tsx'");
    expect(command).toContain("-- '/home/user/repo'");
    expect(command).toContain(
      `sed -n '1,${SANDBOX_GLOB_CAP + 1}p'`,
    );
  });

  it("normalizes paths and quotes apostrophes", () => {
    const command = buildGlobCommand({
      path: "./src//components",
      patterns: ["**/owner's-*.tsx"],
    });

    expect(command).toContain("-- '/home/user/repo/src/components'");
    expect(command).toContain("-g '**/owner'\\''s-*.tsx'");
  });
});

describe("buildGlobResult", () => {
  it("returns sorted repository-relative paths", () => {
    expect(
      buildGlobResult({
        exitCode: 0,
        stderr: "",
        stdout: "/home/user/repo/src/z.ts\n/home/user/repo/src/a.ts\n",
      }),
    ).toEqual({
      cap: SANDBOX_GLOB_CAP,
      paths: ["src/a.ts", "src/z.ts"],
      truncated: false,
    });
  });

  it("uses the extra path to report truncation", () => {
    const stdout = Array.from(
      { length: SANDBOX_GLOB_CAP + 1 },
      (_, index) => `/home/user/repo/src/file-${index}.ts`,
    ).join("\n");

    const result = buildGlobResult({ exitCode: 0, stderr: "", stdout });
    expect(result.paths).toHaveLength(SANDBOX_GLOB_CAP);
    expect(result.truncated).toBe(true);
  });

  it("throws for command failures", () => {
    expect(() =>
      buildGlobResult({ exitCode: 2, stderr: "bad glob", stdout: "" }),
    ).toThrow("bad glob");
  });
});

describe("globSandboxFiles", () => {
  it("runs the provider command and returns paths", async () => {
    runRawCommandMock.mockResolvedValue({
      command: "rg --files ...",
      exitCode: 0,
      stderr: "",
      stdout: "/home/user/repo/src/app.ts\n",
    });

    await expect(
      globSandboxFiles({
        patterns: ["src/**/*.ts"],
        sessionId: "session-test",
      }),
    ).resolves.toEqual({
      cap: SANDBOX_GLOB_CAP,
      paths: ["src/app.ts"],
      truncated: false,
    });
    expect(runRawCommandMock).toHaveBeenCalledWith({
      command: expect.stringContaining("-g 'src/**/*.ts'"),
      sessionId: "session-test",
    });
  });
});
