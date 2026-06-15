import { describe, expect, it } from "vitest";

import {
  normalizeSandboxRelativePath,
  shouldHideSandboxEntry,
  toSandboxRepoPath,
} from "./paths";

describe("normalizeSandboxRelativePath", () => {
  it("returns a normalized relative path", () => {
    expect(normalizeSandboxRelativePath("./src//server\\sandbox/tools")).toBe(
      "src/server/sandbox/tools",
    );
  });

  it("allows the repo root when allowRoot is true", () => {
    expect(normalizeSandboxRelativePath("", { allowRoot: true })).toBe("");
    expect(normalizeSandboxRelativePath("   ", { allowRoot: true })).toBe("");
  });

  it("throws for empty paths when the root is not allowed", () => {
    expect(() => normalizeSandboxRelativePath("")).toThrow("missing_path");
  });

  it("throws for absolute paths and parent traversal", () => {
    expect(() => normalizeSandboxRelativePath("/src/app")).toThrow(
      "invalid_path",
    );
    expect(() => normalizeSandboxRelativePath("../secrets.txt")).toThrow(
      "invalid_path",
    );
  });

  it("throws for blocked path segments", () => {
    expect(() => normalizeSandboxRelativePath(".git/config")).toThrow(
      "invalid_path",
    );
    expect(() => normalizeSandboxRelativePath("node_modules/react")).toThrow(
      "invalid_path",
    );
  });
});

describe("toSandboxRepoPath", () => {
  it("maps the root and nested paths into the sandbox repo path", () => {
    expect(toSandboxRepoPath("")).toBe("/home/user/repo");
    expect(toSandboxRepoPath("src/app/page.tsx")).toBe(
      "/home/user/repo/src/app/page.tsx",
    );
  });
});

describe("shouldHideSandboxEntry", () => {
  it("hides blocked entries and known junk files", () => {
    expect(shouldHideSandboxEntry(".git")).toBe(true);
    expect(shouldHideSandboxEntry("node_modules")).toBe(true);
    expect(shouldHideSandboxEntry(".DS_Store")).toBe(true);
  });

  it("keeps normal entries visible", () => {
    expect(shouldHideSandboxEntry("src")).toBe(false);
    expect(shouldHideSandboxEntry("README.md")).toBe(false);
  });
});
