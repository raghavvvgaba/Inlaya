import { beforeEach, describe, expect, it, vi } from "vitest";

import type { E2BSandboxSession } from "~/server/sandbox/providers/e2b/types";

const { getRunningSandboxToolSessionMock } = vi.hoisted(() => ({
  getRunningSandboxToolSessionMock: vi.fn(),
}));

vi.mock("~/server/sandbox/providers/e2b/lifecycle", () => ({
  getRunningSandboxToolSession: getRunningSandboxToolSessionMock,
}));

import { submitSandboxChanges } from "../submit";

const runCommandMock = vi.fn();

function buildSession(): E2BSandboxSession {
  return {
    logs: [],
    previewState: "ready",
    previewUrl: "https://preview.test",
    sandbox: {
      commands: {
        run: runCommandMock,
      },
    } as unknown as E2BSandboxSession["sandbox"],
    sandboxId: "sandbox-test",
    sessionId: "session-test",
    status: "running",
  };
}

function commandResult(
  overrides: Partial<{
    exitCode: number;
    stderr: string;
    stdout: string;
  }> = {},
) {
  return {
    exitCode: 0,
    stderr: "",
    stdout: "",
    ...overrides,
  };
}

const submitInput = {
  branchName: "tessera/issue-123",
  commitMessage: "Issue #123: Fix the dashboard",
  installationToken: "ghs_secret_submit_token",
  repoName: "example",
  repoOwner: "tessera",
  sessionId: "session-test",
};

beforeEach(() => {
  getRunningSandboxToolSessionMock.mockReset();
  runCommandMock.mockReset();
});

describe("submitSandboxChanges", () => {
  it("returns noop when the sandbox has no changes", async () => {
    const session = buildSession();
    getRunningSandboxToolSessionMock.mockResolvedValue(session);
    runCommandMock.mockResolvedValue(commandResult());

    const result = await submitSandboxChanges(submitInput);

    expect(result).toEqual({
      branchName: "tessera/issue-123",
      message: "No sandbox changes to submit.",
      status: "noop",
    });
    expect(runCommandMock).toHaveBeenCalledTimes(1);
    expect(runCommandMock).toHaveBeenCalledWith(
      "git status --short --untracked-files=normal",
      expect.objectContaining({
        cwd: "/home/user/repo",
        timeoutMs: 15_000,
      }),
    );
    expect(session.submitState).toBe("completed");
    expect(session.submitStage).toBe("done");
  });

  it("creates the branch at submit time, commits, and pushes with a redacted token", async () => {
    const session = buildSession();
    getRunningSandboxToolSessionMock.mockResolvedValue(session);
    runCommandMock.mockImplementation(async (command: string) => {
      if (command === "git status --short --untracked-files=normal") {
        return commandResult({ stdout: " M src/app/page.tsx\n" });
      }

      if (command.startsWith("git rev-parse --verify")) {
        return commandResult({ exitCode: 1 });
      }

      if (command.startsWith("git diff --cached")) {
        return commandResult({ exitCode: 1 });
      }

      if (command === "git rev-parse --short HEAD") {
        return commandResult({ stdout: "abc123\n" });
      }

      return commandResult();
    });

    const result = await submitSandboxChanges(submitInput);
    const commands = runCommandMock.mock.calls.map((call) => call[0]);
    const logText = session.logs.join("");

    expect(result).toEqual({
      branchName: "tessera/issue-123",
      commitHash: "abc123",
      status: "committed",
    });
    expect(commands).toContain("git switch -c 'tessera/issue-123'");
    expect(commands).toContain("git config user.name Tessera-bot");
    expect(commands).toContain(
      "git config user.email tessera-bot@users.noreply.github.com",
    );
    expect(commands).toContain("git add .");
    expect(commands).toContain(
      "git commit -m 'Issue #123: Fix the dashboard'",
    );
    expect(commands.some((command) => command.includes("ghs_secret_submit_token"))).toBe(
      true,
    );
    expect(logText).not.toContain("ghs_secret_submit_token");
    expect(logText).not.toContain(
      "https://x-access-token:ghs_secret_submit_token@github.com",
    );
    expect(logText).toContain(
      "git push 'https://github.com/tessera/example.git' 'HEAD:tessera/issue-123'",
    );
    expect(session.submitState).toBe("completed");
    expect(session.submitStage).toBe("done");
  });

  it("blocks a second submit while one is already running", async () => {
    const session = {
      ...buildSession(),
      submitState: "running" as const,
    };
    getRunningSandboxToolSessionMock.mockResolvedValue(session);

    await expect(submitSandboxChanges(submitInput)).rejects.toThrow(
      "submit_in_progress",
    );
    expect(runCommandMock).not.toHaveBeenCalled();
  });
});
