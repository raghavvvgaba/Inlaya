import "server-only";

import { PROJECT_DIR } from "~/server/sandbox/providers/e2b/constants";
import { getRunningSandboxToolSession } from "~/server/sandbox/providers/e2b/lifecycle";
import {
  appendLog,
  publicSession,
  setSubmitProgress,
} from "~/server/sandbox/providers/e2b/session-state";
import type { E2BSandboxSession } from "~/server/sandbox/providers/e2b/types";
import type {
  SandboxCommandResult,
  SandboxSession,
  SandboxSubmitChangesInput,
  SandboxSubmitChangesResult,
  SandboxSubmitProgressInput,
  SandboxSubmitStage,
} from "~/server/sandbox/types";

type SubmitCommandInput = {
  command: string;
  displayCommand?: string;
  sensitiveValues?: string[];
  stage?: SandboxSubmitStage;
  statusMessage?: string;
  timeoutMs?: number;
};

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function buildAuthenticatedRepoUrl(input: {
  installationToken: string;
  repoName: string;
  repoOwner: string;
}) {
  return `https://x-access-token:${encodeURIComponent(input.installationToken)}@github.com/${input.repoOwner}/${input.repoName}.git`;
}

function buildSafeRepoUrl(input: { repoName: string; repoOwner: string }) {
  return `https://github.com/${input.repoOwner}/${input.repoName}.git`;
}

function registerSensitiveValues(
  session: E2BSandboxSession,
  values: string[] = [],
) {
  session.sensitiveLogValues = [
    ...(session.sensitiveLogValues ?? []),
    ...values.filter(Boolean),
  ];
}

function markProgress(
  session: E2BSandboxSession,
  stage: SandboxSubmitStage,
  message: string,
) {
  setSubmitProgress(session, {
    message,
    stage,
    state: "running",
  });
  appendLog(session, `\n${message}\n`);
}

async function runSubmitCommand(
  session: E2BSandboxSession,
  input: SubmitCommandInput,
): Promise<SandboxCommandResult> {
  if (input.stage && input.statusMessage) {
    markProgress(session, input.stage, input.statusMessage);
  }

  registerSensitiveValues(session, input.sensitiveValues);
  appendLog(session, `\n$ ${input.displayCommand ?? input.command}\n`);

  try {
    const result = await session.sandbox!.commands.run(input.command, {
      cwd: PROJECT_DIR,
      timeoutMs: input.timeoutMs ?? 30_000,
      onStdout: (data: string) => appendLog(session, data),
      onStderr: (data: string) => appendLog(session, data),
    });

    return {
      command: input.displayCommand ?? input.command,
      exitCode: result.exitCode,
      stderr: result.stderr,
      stdout: result.stdout,
    };
  } catch (error) {
    const stdout =
      error instanceof Error &&
      "stdout" in error &&
      typeof error.stdout === "string"
        ? error.stdout
        : "";
    const stderr =
      error instanceof Error &&
      "stderr" in error &&
      typeof error.stderr === "string"
        ? error.stderr
        : "";
    const exitCode =
      error instanceof Error &&
      "exitCode" in error &&
      typeof error.exitCode === "number"
        ? error.exitCode
        : undefined;

    if (typeof exitCode === "number" || stdout || stderr) {
      return {
        command: input.displayCommand ?? input.command,
        exitCode,
        stderr,
        stdout,
      };
    }

    throw error;
  }
}

function assertSuccessfulCommand(
  result: SandboxCommandResult,
  fallback: string,
) {
  if (result.exitCode === 0 || typeof result.exitCode === "undefined") {
    return;
  }

  throw new Error(result.stderr.trim() || result.stdout.trim() || fallback);
}

async function remoteBranchExists(input: {
  authenticatedRepoUrl: string;
  branchName: string;
  safeRepoUrl: string;
  session: E2BSandboxSession;
  sensitiveValues: string[];
}) {
  const result = await runSubmitCommand(input.session, {
    command: `git ls-remote --heads ${shellQuote(input.authenticatedRepoUrl)} ${shellQuote(input.branchName)}`,
    displayCommand: `git ls-remote --heads ${shellQuote(input.safeRepoUrl)} ${shellQuote(input.branchName)}`,
    sensitiveValues: input.sensitiveValues,
    timeoutMs: 30_000,
  });

  assertSuccessfulCommand(result, "Unable to inspect remote branch.");
  return result.stdout.trim().length > 0;
}

async function prepareBranch(input: {
  authenticatedRepoUrl: string;
  branchName: string;
  safeRepoUrl: string;
  session: E2BSandboxSession;
  sensitiveValues: string[];
}) {
  markProgress(
    input.session,
    "preparing-branch",
    `Preparing branch ${input.branchName}`,
  );

  const localBranch = await runSubmitCommand(input.session, {
    command: `git rev-parse --verify --quiet ${shellQuote(`refs/heads/${input.branchName}`)}`,
  });

  if (localBranch.exitCode === 0) {
    const switchResult = await runSubmitCommand(input.session, {
      command: `git switch ${shellQuote(input.branchName)}`,
    });
    assertSuccessfulCommand(switchResult, "Unable to switch to issue branch.");
    return;
  }

  if (
    await remoteBranchExists({
      authenticatedRepoUrl: input.authenticatedRepoUrl,
      branchName: input.branchName,
      safeRepoUrl: input.safeRepoUrl,
      sensitiveValues: input.sensitiveValues,
      session: input.session,
    })
  ) {
    const fetchResult = await runSubmitCommand(input.session, {
      command: `git fetch ${shellQuote(input.authenticatedRepoUrl)} ${shellQuote(`${input.branchName}:${input.branchName}`)}`,
      displayCommand: `git fetch ${shellQuote(input.safeRepoUrl)} ${shellQuote(`${input.branchName}:${input.branchName}`)}`,
      sensitiveValues: input.sensitiveValues,
      timeoutMs: 60_000,
    });
    assertSuccessfulCommand(fetchResult, "Unable to fetch issue branch.");

    const switchResult = await runSubmitCommand(input.session, {
      command: `git switch ${shellQuote(input.branchName)}`,
    });
    assertSuccessfulCommand(switchResult, "Unable to switch to issue branch.");
    return;
  }

  const createResult = await runSubmitCommand(input.session, {
    command: `git switch -c ${shellQuote(input.branchName)}`,
  });
  assertSuccessfulCommand(createResult, "Unable to create issue branch.");
}

export async function setSandboxSubmitProgress(
  input: SandboxSubmitProgressInput,
): Promise<SandboxSession> {
  const session = await getRunningSandboxToolSession(input.sessionId);

  setSubmitProgress(session, {
    message: input.message,
    stage: input.stage,
    state: input.state,
  });

  if (input.message) {
    appendLog(session, `\n${input.message}\n`);
  }

  return publicSession(session);
}

export async function submitSandboxChanges(
  input: SandboxSubmitChangesInput,
): Promise<SandboxSubmitChangesResult> {
  const session = await getRunningSandboxToolSession(input.sessionId);

  if (session.submitState === "running") {
    throw new Error("submit_in_progress");
  }

  const authenticatedRepoUrl = buildAuthenticatedRepoUrl(input);
  const safeRepoUrl = buildSafeRepoUrl(input);
  const sensitiveValues = [
    input.installationToken,
    encodeURIComponent(input.installationToken),
    authenticatedRepoUrl,
  ];

  try {
    setSubmitProgress(session, {
      message: "Checking for sandbox changes",
      stage: "checking-changes",
      state: "running",
    });

    const statusResult = await runSubmitCommand(session, {
      command: "git status --short --untracked-files=normal",
      stage: "checking-changes",
      statusMessage: "Checking for sandbox changes",
      timeoutMs: 15_000,
    });
    assertSuccessfulCommand(statusResult, "Unable to inspect sandbox changes.");

    if (!statusResult.stdout.trim()) {
      setSubmitProgress(session, {
        message: "No sandbox changes to submit.",
        stage: "done",
        state: "completed",
      });

      return {
        branchName: input.branchName,
        message: "No sandbox changes to submit.",
        status: "noop",
      };
    }

    await prepareBranch({
      authenticatedRepoUrl,
      branchName: input.branchName,
      safeRepoUrl,
      sensitiveValues,
      session,
    });

    const configNameResult = await runSubmitCommand(session, {
      command: "git config user.name Tessera-bot",
      stage: "committing",
      statusMessage: "Configuring commit author",
    });
    assertSuccessfulCommand(configNameResult, "Unable to configure git author.");

    const configEmailResult = await runSubmitCommand(session, {
      command: "git config user.email tessera-bot@users.noreply.github.com",
    });
    assertSuccessfulCommand(configEmailResult, "Unable to configure git email.");

    const addResult = await runSubmitCommand(session, {
      command: "git add .",
      stage: "staging",
      statusMessage: "Staging files",
    });
    assertSuccessfulCommand(addResult, "Unable to stage sandbox changes.");

    const stagedResult = await runSubmitCommand(session, {
      command: "git diff --cached --quiet --exit-code",
    });

    if (stagedResult.exitCode === 0) {
      setSubmitProgress(session, {
        message: "No new staged changes to submit.",
        stage: "done",
        state: "completed",
      });

      return {
        branchName: input.branchName,
        message: "No new staged changes to submit.",
        status: "noop",
      };
    }

    if (stagedResult.exitCode !== 1) {
      throw new Error(
        stagedResult.stderr.trim() ||
          stagedResult.stdout.trim() ||
          "Unable to inspect staged changes.",
      );
    }

    const commitResult = await runSubmitCommand(session, {
      command: `git commit -m ${shellQuote(input.commitMessage)}`,
      stage: "committing",
      statusMessage: "Creating commit",
      timeoutMs: 60_000,
    });
    assertSuccessfulCommand(commitResult, "Unable to commit sandbox changes.");

    const pushResult = await runSubmitCommand(session, {
      command: `git push ${shellQuote(authenticatedRepoUrl)} ${shellQuote(`HEAD:${input.branchName}`)}`,
      displayCommand: `git push ${shellQuote(safeRepoUrl)} ${shellQuote(`HEAD:${input.branchName}`)}`,
      sensitiveValues,
      stage: "pushing",
      statusMessage: "Pushing branch to GitHub",
      timeoutMs: 120_000,
    });
    assertSuccessfulCommand(pushResult, "Unable to push issue branch.");

    const commitHashResult = await runSubmitCommand(session, {
      command: "git rev-parse --short HEAD",
    });
    assertSuccessfulCommand(commitHashResult, "Unable to read commit hash.");

    setSubmitProgress(session, {
      message: "Branch pushed to GitHub.",
      stage: "done",
      state: "completed",
    });

    return {
      branchName: input.branchName,
      commitHash: commitHashResult.stdout.trim(),
      status: "committed",
    };
  } catch (error) {
    setSubmitProgress(session, {
      message:
        error instanceof Error
          ? error.message
          : "Submit failed before the pull request could be created.",
      stage: "error",
      state: "failed",
    });
    throw error;
  }
}
