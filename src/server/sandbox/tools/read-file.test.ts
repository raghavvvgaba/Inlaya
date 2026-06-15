import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_SANDBOX_READ_LINE_COUNT,
  DEFAULT_SANDBOX_READ_MAX_CHARACTERS,
} from "~/server/sandbox/providers/e2b/constants";

const { readRawFileMock } = vi.hoisted(() => ({
  readRawFileMock: vi.fn(),
}));

vi.mock("~/server/sandbox/provider", () => ({
  sandboxProvider: {
    readRawFile: readRawFileMock,
  },
}));

import { readSandboxFile, sliceSandboxFileContent } from "./read-file";

function buildInput(overrides: Partial<Parameters<typeof sliceSandboxFileContent>[1]> = {}) {
  return {
    path: "src/app/page.tsx",
    sessionId: "session-test",
    ...overrides,
  };
}

beforeEach(() => {
  readRawFileMock.mockReset();
});

describe("sliceSandboxFileContent", () => {
  it("returns empty metadata for an empty file", () => {
    expect(sliceSandboxFileContent("", buildInput())).toEqual({
      content: "",
      endLine: 0,
      startLine: 0,
      totalLines: 0,
      truncated: false,
    });
  });

  it("normalizes windows line endings", () => {
    expect(
      sliceSandboxFileContent("alpha\r\nbeta\r\ngamma", buildInput()),
    ).toMatchObject({
      content: "alpha\nbeta\ngamma",
      endLine: 3,
      startLine: 1,
      totalLines: 3,
      truncated: false,
    });
  });

  it("throws for invalid start or end ranges", () => {
    expect(() => sliceSandboxFileContent("alpha", buildInput({ startLine: 0 }))).toThrow(
      "invalid_line_range",
    );
    expect(() =>
      sliceSandboxFileContent(
        "alpha\nbeta",
        buildInput({ endLine: 1, startLine: 2 }),
      ),
    ).toThrow("invalid_line_range");
  });

  it("reads through eof when endLine is -1", () => {
    expect(
      sliceSandboxFileContent(
        "one\ntwo\nthree\nfour",
        buildInput({ endLine: -1, startLine: 3 }),
      ),
    ).toEqual({
      content: "three\nfour",
      endLine: 4,
      startLine: 3,
      totalLines: 4,
      truncated: true,
    });
  });

  it("clamps the requested start line to the last line", () => {
    expect(
      sliceSandboxFileContent("one\ntwo\nthree", buildInput({ startLine: 99 })),
    ).toEqual({
      content: "three",
      endLine: 3,
      startLine: 3,
      totalLines: 3,
      truncated: true,
    });
  });

  it("uses the default line-count limit when no explicit endLine is provided", () => {
    const content = Array.from(
      { length: DEFAULT_SANDBOX_READ_LINE_COUNT + 5 },
      (_, index) => `line ${index + 1}`,
    ).join("\n");

    const result = sliceSandboxFileContent(content, buildInput());

    expect(result.startLine).toBe(1);
    expect(result.endLine).toBe(DEFAULT_SANDBOX_READ_LINE_COUNT);
    expect(result.totalLines).toBe(DEFAULT_SANDBOX_READ_LINE_COUNT + 5);
    expect(result.truncated).toBe(true);
    expect(result.content.split("\n")).toHaveLength(DEFAULT_SANDBOX_READ_LINE_COUNT);
    expect(result.content.split("\n")[0]).toBe("line 1");
    expect(result.content.split("\n").at(-1)).toBe(
      `line ${DEFAULT_SANDBOX_READ_LINE_COUNT}`,
    );
  });

  it("applies the default character cap when no explicit endLine is provided", () => {
    const longLine = "x".repeat(DEFAULT_SANDBOX_READ_MAX_CHARACTERS);
    const result = sliceSandboxFileContent(
      `${longLine}\nsecond line`,
      buildInput(),
    );

    expect(result).toEqual({
      content: longLine,
      endLine: 1,
      startLine: 1,
      totalLines: 2,
      truncated: true,
    });
  });

  it("does not apply the default character cap when endLine is explicit", () => {
    const longLine = "x".repeat(DEFAULT_SANDBOX_READ_MAX_CHARACTERS);
    const result = sliceSandboxFileContent(
      `${longLine}\nsecond line`,
      buildInput({ endLine: 2 }),
    );

    expect(result).toEqual({
      content: `${longLine}\nsecond line`,
      endLine: 2,
      startLine: 1,
      totalLines: 2,
      truncated: false,
    });
  });

  it("reads the raw file through the provider and returns sandbox file metadata", async () => {
    readRawFileMock.mockResolvedValue({
      content: "alpha\nbeta\ngamma",
      path: "src/app/page.tsx",
      size: 16,
    });

    const result = await readSandboxFile(
      buildInput({
        startLine: 2,
      }),
    );

    expect(readRawFileMock).toHaveBeenCalledWith({
      path: "src/app/page.tsx",
      sessionId: "session-test",
    });
    expect(result).toEqual({
      content: "beta\ngamma",
      endLine: 3,
      path: "src/app/page.tsx",
      size: 16,
      startLine: 2,
      totalLines: 3,
      truncated: true,
    });
  });
});
