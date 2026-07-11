import type { CommandHandle } from "e2b";

import {
  EDIT_PREVIEW_TIMEOUT_MS,
  PREVIEW_PORT,
  PREVIEW_RETRY_DELAY_MS,
  PREVIEW_VERSION_PATH,
  RESTART_PREVIEW_TIMEOUT_MS,
  STARTUP_PREVIEW_TIMEOUT_MS,
} from "~/server/sandbox/providers/e2b/constants";
import { verifySandboxHealth } from "~/server/sandbox/providers/e2b/sandbox-ops";
import {
  appendLog,
  describeSessionError,
  publicSession,
  setPreviewError,
  setPreviewState,
} from "~/server/sandbox/providers/e2b/session-state";
import type { E2BSandboxSession } from "~/server/sandbox/providers/e2b/types";

const VITE_REACT_ERROR_MARKERS = [
  "vite-error-overlay",
  "plugin:vite",
  "[vite] Internal server error",
  "Failed to resolve import",
  "React is not defined",
  "ReferenceError:",
  "TypeError:",
] as const;

export type VitePreviewContentCheckResult =
  | { ok: true }
  | {
      details: string;
      marker?: string;
      ok: false;
      reason:
        | "blank_preview"
        | "browser_check_failed"
        | "empty_preview"
        | "fetch_failed"
        | "runtime_error_marker";
    };

function getPreviewVersionUrl(session: E2BSandboxSession) {
  return `${session.previewUrl.replace(/\/$/, "")}/${PREVIEW_VERSION_PATH}`;
}

async function fetchPreviewVersion(session: E2BSandboxSession) {
  try {
    const response = await fetch(`${getPreviewVersionUrl(session)}?t=${Date.now()}`, {
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });

    if (!response.ok) return null;

    const version = (await response.text()).trim();
    return version || null;
  } catch {
    return null;
  }
}

export async function waitForPreview(
  session: E2BSandboxSession,
  expectedVersion?: string,
  options: { timeoutMs?: number; retryDelayMs?: number; offlineMessage?: string } = {},
) {
  const startedAt = Date.now();
  const timeoutMs = options.timeoutMs ?? STARTUP_PREVIEW_TIMEOUT_MS;
  const retryDelayMs = options.retryDelayMs ?? PREVIEW_RETRY_DELAY_MS;
  let lastObservedVersion: string | undefined;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(session.previewUrl, {
        signal: AbortSignal.timeout(4000),
        cache: "no-store",
      });

      if (!response.ok) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        continue;
      }

      const observedVersion = await fetchPreviewVersion(session);
      if (observedVersion) {
        session.previewObservedVersion = observedVersion;
        lastObservedVersion = observedVersion;
      }

      if (!expectedVersion || observedVersion === expectedVersion) {
        if (!session.previewVersion && observedVersion) {
          session.previewVersion = observedVersion;
        }
        setPreviewState(session, "ready", "Preview ready.");
        return true;
      }
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  }

  if (expectedVersion && lastObservedVersion && lastObservedVersion !== expectedVersion) {
    setPreviewState(
      session,
      "stale",
      "Change saved. Refresh the preview tab if it still looks old.",
    );
    appendLog(
      session,
      `\nPreview is reachable but still serving ${lastObservedVersion} instead of ${expectedVersion}. Refresh may be needed.\n`,
    );
    return false;
  }

  setPreviewState(
    session,
    "offline",
    options.offlineMessage ?? "Preview unavailable. Restart the preview.",
  );
  appendLog(
    session,
    "\nPreview did not respond before the readiness timeout. The URL may still become available.\n",
  );
  return false;
}

export async function stopPreviewProcess(session: E2BSandboxSession) {
  if (!session.sandbox || !session.previewProcessId) return false;

  try {
    const killed = await session.sandbox.commands.kill(session.previewProcessId, {
      requestTimeoutMs: 10_000,
    });
    if (killed) {
      appendLog(session, `Stopped preview process ${session.previewProcessId}\n`);
    }
    session.previewProcessId = undefined;
    return killed;
  } catch {
    session.previewProcessId = undefined;
    return false;
  }
}

export async function startPreviewServer(
  session: E2BSandboxSession,
  reason = "Starting",
) {
  if (!session.sandbox) throw new Error("Sandbox is not ready.");
  if (!session.previewCommand || !session.previewCwd) {
    throw new Error("Preview command is not configured for this sandbox.");
  }

  appendLog(session, `\n${reason} preview server on port ${PREVIEW_PORT}...\n`);
  appendLog(session, `$ ${session.previewCommand}\n`);

  const command = (await session.sandbox.commands.run(session.previewCommand, {
    cwd: session.previewCwd,
    background: true,
    onStdout: (data: string) => appendLog(session, data),
    onStderr: (data: string) => appendLog(session, data),
  })) as CommandHandle;

  session.previewProcessId = command.pid;
  appendLog(session, `Preview process started with pid ${command.pid}\n`);
}

export async function restartPreviewServer(
  session: E2BSandboxSession,
  reason = "Restarting",
) {
  setPreviewState(session, "recovering", "Preview reconnecting.");
  await stopPreviewProcess(session);
  await startPreviewServer(session, reason);
}

async function isPreviewProcessRunning(session: E2BSandboxSession) {
  if (!session.sandbox || !session.previewProcessId) return false;

  const processes = await session.sandbox.commands.list({ requestTimeoutMs: 10_000 });
  return processes.some((process) => process.pid === session.previewProcessId);
}

async function isPreviewUrlReachable(session: E2BSandboxSession) {
  try {
    const response = await fetch(session.previewUrl, {
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });

    return response.ok;
  } catch {
    return false;
  }
}

function getHtmlBody(html: string) {
  const bodyMatch = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  return bodyMatch?.[1] ?? html;
}

export function checkViteReactPreviewHtml(html: string): VitePreviewContentCheckResult {
  const trimmedHtml = html.trim();
  const normalizedHtml = trimmedHtml.replace(/\s+/g, " ");

  if (trimmedHtml.length < 80) {
    return {
      details: "Preview response was empty or too small to be a Vite React page.",
      ok: false,
      reason: "empty_preview",
    };
  }

  const matchedMarker = VITE_REACT_ERROR_MARKERS.find((marker) =>
    normalizedHtml.includes(marker),
  );

  if (matchedMarker) {
    return {
      details: `Vite React preview response contained "${matchedMarker}".`,
      marker: matchedMarker,
      ok: false,
      reason: "runtime_error_marker",
    };
  }

  const body = getHtmlBody(trimmedHtml);
  const hasReactMount = /\bid=["']root["']/.test(body);
  const hasModuleScript = /<script\b[^>]*\btype=["']module["']/i.test(body);

  if (!hasReactMount && !hasModuleScript && body.trim().length < 80) {
    return {
      details: "Preview body was empty or missing the Vite React mount point.",
      ok: false,
      reason: "empty_preview",
    };
  }

  return { ok: true };
}

export async function checkViteReactPreviewContent(
  session: E2BSandboxSession,
): Promise<VitePreviewContentCheckResult> {
  try {
    const response = await fetch(session.previewUrl, {
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        details: `Preview returned HTTP ${response.status}.`,
        ok: false,
        reason: "fetch_failed",
      };
    }

    return checkViteReactPreviewHtml(await response.text());
  } catch (error) {
    return {
      details: error instanceof Error ? error.message : "Unable to fetch preview HTML.",
      ok: false,
      reason: "fetch_failed",
    };
  }
}

async function applyViteReactPreviewContentCheck(session: E2BSandboxSession) {
  const result = await checkViteReactPreviewContent(session);
  if (!result.ok) {
    appendLog(session, `Preview check failed: ${result.details}\n`);
    setPreviewError(session, result.details);
    return false;
  }

  const browserResult = await checkViteReactPreviewBrowser(session);
  if (browserResult.ok) {
    setPreviewError(session);
    return true;
  }

  if (browserResult.reason === "browser_check_failed") {
    appendLog(session, `Preview browser check skipped: ${browserResult.details}\n`);
    setPreviewError(session);
    return true;
  }

  appendLog(session, `Preview browser check failed: ${browserResult.details}\n`);
  setPreviewError(session, browserResult.details);
  return false;
}

export async function checkPreviewContentForDiagnostics(session: E2BSandboxSession) {
  appendLog(session, "\nManual preview error check requested.\n");
  await applyViteReactPreviewContentCheck(session);
  return publicSession(session);
}

export async function checkViteReactPreviewBrowser(
  session: E2BSandboxSession,
): Promise<VitePreviewContentCheckResult> {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage();
      const observedErrors: string[] = [];

      page.on("console", (message) => {
        if (message.type() === "error") {
          observedErrors.push(message.text());
        }
      });
      page.on("pageerror", (error) => {
        observedErrors.push(error.message);
      });

      await page.goto(session.previewUrl, {
        timeout: 8_000,
        waitUntil: "domcontentloaded",
      });
      await page.waitForTimeout(1_500);

      const rootState = await page.evaluate(() => {
        const root = document.querySelector("#root");
        const bodyText = document.body.innerText.trim();

        return {
          bodyTextLength: bodyText.length,
          hasRoot: Boolean(root),
          rootChildCount: root?.childElementCount ?? 0,
          rootTextLength: root?.textContent?.trim().length ?? 0,
        };
      });

      if (observedErrors.length > 0) {
        return {
          details: observedErrors[0] ?? "Browser console error.",
          ok: false,
          reason: "runtime_error_marker",
        };
      }

      if (
        rootState.hasRoot &&
        rootState.rootChildCount === 0 &&
        rootState.rootTextLength === 0 &&
        rootState.bodyTextLength === 0
      ) {
        return {
          details: "Vite React root stayed empty after browser render.",
          ok: false,
          reason: "blank_preview",
        };
      }

      return { ok: true };
    } finally {
      await browser.close();
    }
  } catch (error) {
    return {
      details: error instanceof Error ? error.message : "Unable to run browser check.",
      ok: false,
      reason: "browser_check_failed",
    };
  }
}

export async function syncPreviewHealth(session: E2BSandboxSession) {
  const urlReachable = await isPreviewUrlReachable(session);

  if (urlReachable) {
    const observedVersion = await fetchPreviewVersion(session);
    if (observedVersion) {
      session.previewObservedVersion = observedVersion;
      if (!session.previewVersion) {
        session.previewVersion = observedVersion;
      }
    }

    if (session.previewVersion && observedVersion && observedVersion !== session.previewVersion) {
      setPreviewState(
        session,
        "stale",
        "Change saved. Refresh the preview tab if it still looks old.",
      );
      return true;
    }

    setPreviewState(session, "ready", "Preview ready.");
    return true;
  }

  const processRunning = await isPreviewProcessRunning(session);
  setPreviewState(
    session,
    processRunning ? "recovering" : "offline",
    processRunning ? "Preview reconnecting." : "Preview unavailable.",
  );
  return false;
}

export async function ensurePreviewServer(session: E2BSandboxSession) {
  if (!session.sandbox || session.status !== "running") return;
  if (session.restartingPreview) {
    await session.restartingPreview;
    return;
  }

  const healthy = await syncPreviewHealth(session);
  if (healthy) return;

  const restart = async () => {
    appendLog(
      session,
      `\nPreview health check failed. Restarting preview server on port ${PREVIEW_PORT}...\n`,
    );

    try {
      await restartPreviewServer(session);
      const recovered = await waitForPreview(session, session.previewVersion, {
        timeoutMs: RESTART_PREVIEW_TIMEOUT_MS,
      });
      if (recovered) {
        appendLog(session, "Preview server recovered.\n");
        return;
      }

      if (session.previewState === "stale") {
        appendLog(session, "Preview server is up, but the latest change has not appeared yet.\n");
        return;
      }

      appendLog(session, "Preview restart failed to recover. Checking sandbox health...\n");
      await verifySandboxHealth(session);
      setPreviewState(session, "offline", "Preview unavailable. Restart the preview.");
      appendLog(session, "Preview restart finished but the preview is still unavailable.\n");
    } catch (error) {
      appendLog(session, "Preview recovery failed. Checking sandbox health...\n");
      await verifySandboxHealth(session);
      setPreviewState(session, "offline", "Preview unavailable. Restart the preview.");
      appendLog(session, `Preview restart failed: ${describeSessionError(session, error)}\n`);
      throw error;
    }
  };

  session.restartingPreview = restart().finally(() => {
    session.restartingPreview = undefined;
  });

  await session.restartingPreview;
}

export async function recoverPreviewAfterEdit(session: E2BSandboxSession) {
  const processAliveAfterWrite = await isPreviewProcessRunning(session);
  appendLog(
    session,
    `Preview process after write: ${processAliveAfterWrite ? "running" : "stopped"}\n`,
  );

  const urlReachableAfterWrite = processAliveAfterWrite
    ? await isPreviewUrlReachable(session)
    : false;
  appendLog(
    session,
    `Preview URL after write: ${urlReachableAfterWrite ? "reachable" : "unreachable"}\n`,
  );

  if (!processAliveAfterWrite || !urlReachableAfterWrite) {
    appendLog(session, "Edit detected preview failure. Attempting one automatic restart...\n");

    try {
      await restartPreviewServer(session, "Restarting");
      const recovered = await waitForPreview(session, session.previewVersion, {
        timeoutMs: RESTART_PREVIEW_TIMEOUT_MS,
        offlineMessage: "Preview crashed after the change and did not recover.",
      });
      appendLog(
        session,
        `Automatic restart result: ${recovered ? "recovered" : "not recovered"}\n`,
      );
      return recovered;
    } catch (error) {
      appendLog(session, `Automatic restart failed: ${describeSessionError(session, error)}\n`);
      await verifySandboxHealth(session);
      setPreviewState(
        session,
        "offline",
        "Preview crashed after the change. Restart the preview.",
      );
      return false;
    }
  }

  const fresh = await waitForPreview(session, session.previewVersion, {
    timeoutMs: EDIT_PREVIEW_TIMEOUT_MS,
    offlineMessage: "Preview unavailable after the change. Restart the preview.",
  });
  if (fresh) {
    const contentOk = await applyViteReactPreviewContentCheck(session);
    appendLog(
      session,
      `Preview content check: ${contentOk ? "passed" : session.previewState}\n`,
    );
    return contentOk;
  }

  appendLog(
    session,
    `Edit freshness result: ${session.previewState}\n`,
  );
  return false;
}
