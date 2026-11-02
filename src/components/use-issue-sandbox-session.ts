"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { sandboxSessionUpdatedEvent } from "~/lib/sandbox-events";

export type SandboxStatus = "starting" | "installing" | "running" | "stopped" | "error";
type PreviewState = "ready" | "recovering" | "offline";
export type StartupStage =
  | "creating"
  | "scaffolding"
  | "installing"
  | "seeding"
  | "starting-preview"
  | "ready"
  | "error";

export type SandboxSession = {
  endAt?: string;
  environmentId: string;
  failureCode?: "startup_failed" | "unsupported_repository";
  failureMessage?: string;
  logs: string[];
  message?: string;
  previewError?: string;
  previewMessage?: string;
  previewState: PreviewState;
  previewUrl: string;
  remainingMs?: number;
  sessionId: string;
  startedAt?: string;
  startupMessage?: string;
  startupStage?: StartupStage;
  status: SandboxStatus;
};

type SandboxResponse =
  | {
      ok: true;
      session: SandboxSession;
    }
  | {
      error: string;
      ok: false;
    };

type SavedSandboxSession = {
  environmentId: string;
  sessionId: string;
};

export type IssueSandboxActions = {
  checkPreviewAction: string;
  heartbeatAction: string;
  projectId: string;
  restartPreviewAction: string;
  sessionAction: string;
  startAction: string;
  stopAction: string;
};

export type IssueSandboxPhase =
  | "idle"
  | "booting"
  | "running"
  | "stopped"
  | "failed"
  | "unsupported";

const ACTIVE_STATUSES = new Set<SandboxStatus>([
  "starting",
  "installing",
  "running",
]);
const POLL_INTERVAL_MS = 2500;
const HEARTBEAT_INTERVAL_MS = 30_000;

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Sandbox request failed.";
}

function isSessionNotFoundError(error: unknown) {
  return error instanceof Error && error.message === "session_not_found";
}

async function readSandboxResponse(response: Response) {
  const bodyText = await response.text();
  let result: SandboxResponse | null = null;

  try {
    result = bodyText ? (JSON.parse(bodyText) as SandboxResponse) : null;
  } catch {
    const contentType = response.headers.get("content-type") ?? "unknown";
    const preview = bodyText.trim().replace(/\s+/g, " ").slice(0, 240);

    throw new Error(
      `Sandbox returned ${response.status} ${response.statusText || "response"} instead of JSON (${contentType}). ${
        preview ? `Response: ${preview}` : "The response body was empty."
      }`,
    );
  }

  if (!result) {
    throw new Error(
      `Sandbox returned ${response.status} ${response.statusText || "response"} with an empty response body.`,
    );
  }

  if (!response.ok || !result.ok) {
    throw new Error(result.ok ? "Sandbox request failed." : result.error);
  }

  return result.session;
}

export function useIssueSandboxSession({
  checkPreviewAction,
  heartbeatAction,
  projectId,
  restartPreviewAction,
  sessionAction,
  startAction,
  stopAction,
}: IssueSandboxActions) {
  const storageKey = useMemo(() => `devin:sandbox:${projectId}`, [projectId]);
  const [session, setSession] = useState<SandboxSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isCheckingPreview, setIsCheckingPreview] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const isActive = session ? ACTIVE_STATUSES.has(session.status) : false;
  const canOpenPreview =
    session?.status === "running" && Boolean(session.previewUrl);
  const status = session?.status ?? "stopped";
  const statusMessage =
    session?.status === "stopped" || session?.status === "error"
      ? session.message ?? session.startupMessage
      : session?.previewMessage ?? session?.startupMessage ?? session?.message;

  // The host exists before dependencies and the preview server are ready, so
  // anything active without a reachable preview is still booting.
  let phase: IssueSandboxPhase;
  if (canOpenPreview) {
    phase = "running";
  } else if (isStarting || isActive) {
    phase = "booting";
  } else if (session?.failureCode === "unsupported_repository") {
    phase = "unsupported";
  } else if (session?.status === "error" || session?.failureCode === "startup_failed") {
    phase = "failed";
  } else if (session?.status === "stopped") {
    phase = "stopped";
  } else {
    phase = "idle";
  }

  const saveSession = useCallback(
    (nextSession: SandboxSession) => {
      setSession(nextSession);

      if (
        nextSession.status === "stopped" ||
        nextSession.status === "error"
      ) {
        window.localStorage.removeItem(storageKey);
        return;
      }

      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          environmentId: nextSession.environmentId,
          sessionId: nextSession.sessionId,
        } satisfies SavedSandboxSession),
      );
    },
    [storageKey],
  );

  const clearSavedSession = useCallback(() => {
    window.localStorage.removeItem(storageKey);
  }, [storageKey]);

  const refreshSession = useCallback(
    async (sessionId: string) => {
      const url = new URL(sessionAction, window.location.origin);
      url.searchParams.set("sessionId", sessionId);
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });
      const nextSession = await readSandboxResponse(response);
      saveSession(nextSession);
      return nextSession;
    },
    [saveSession, sessionAction],
  );

  const loadCurrentProjectSession = useCallback(async () => {
    const response = await fetch(sessionAction, {
      headers: {
        Accept: "application/json",
      },
    });
    const nextSession = await readSandboxResponse(response);
    saveSession(nextSession);
    return nextSession;
  }, [saveSession, sessionAction]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapSession() {
      const savedValue = window.localStorage.getItem(storageKey);

      if (savedValue) {
        try {
          const saved = JSON.parse(savedValue) as Partial<SavedSandboxSession>;

          if (saved.sessionId) {
            try {
              await refreshSession(saved.sessionId);
              setError(null);
              return;
            } catch (refreshError) {
              if (!isSessionNotFoundError(refreshError)) {
                setError(getErrorMessage(refreshError));
              }
            }
          } else {
            clearSavedSession();
          }
        } catch {
          clearSavedSession();
        }
      }

      try {
        await loadCurrentProjectSession();
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        if (isSessionNotFoundError(loadError)) {
          setSession(null);
          setError(null);
          clearSavedSession();
          return;
        }

        clearSavedSession();
        setError(getErrorMessage(loadError));
      }
    }

    void bootstrapSession();

    return () => {
      cancelled = true;
    };
  }, [
    clearSavedSession,
    loadCurrentProjectSession,
    refreshSession,
    storageKey,
  ]);

  useEffect(() => {
    if (!session || session.status === "running" || session.status === "stopped" || session.status === "error") {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshSession(session.sessionId).catch((refreshError) => {
        setError(getErrorMessage(refreshError));
      });
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [refreshSession, session]);

  useEffect(() => {
    if (!session || !isActive) return;

    const heartbeat = async () => {
      const response = await fetch(heartbeatAction, {
        body: JSON.stringify({ sessionId: session.sessionId }),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const nextSession = await readSandboxResponse(response);
      saveSession(nextSession);
    };

    const interval = window.setInterval(() => {
      void heartbeat().catch((heartbeatError) => {
        setError(getErrorMessage(heartbeatError));
      });
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [heartbeatAction, isActive, saveSession, session]);

  useEffect(() => {
    function handleSandboxSessionUpdated(event: Event) {
      const customEvent = event as CustomEvent<{
        projectId?: string;
        sessionId?: string;
      }>;

      if (customEvent.detail?.projectId !== projectId) {
        return;
      }

      const sessionId = customEvent.detail.sessionId ?? session?.sessionId;
      if (!sessionId) {
        void loadCurrentProjectSession().catch((loadError) => {
          setError(getErrorMessage(loadError));
        });
        return;
      }

      void refreshSession(sessionId).catch((refreshError) => {
        setError(getErrorMessage(refreshError));
      });
    }

    window.addEventListener(sandboxSessionUpdatedEvent, handleSandboxSessionUpdated);
    return () => {
      window.removeEventListener(
        sandboxSessionUpdatedEvent,
        handleSandboxSessionUpdated,
      );
    };
  }, [loadCurrentProjectSession, projectId, refreshSession, session?.sessionId]);

  async function start() {
    if (isStarting) return;

    setError(null);
    setIsStarting(true);

    try {
      const response = await fetch(startAction, {
        headers: {
          Accept: "application/json",
        },
        method: "POST",
      });
      const nextSession = await readSandboxResponse(response);
      saveSession(nextSession);
    } catch (startError) {
      setError(getErrorMessage(startError));
    } finally {
      setIsStarting(false);
    }
  }

  async function restartPreview() {
    if (!session || isRestarting) return;

    setError(null);
    setIsRestarting(true);

    try {
      const response = await fetch(restartPreviewAction, {
        body: JSON.stringify({ sessionId: session.sessionId }),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const nextSession = await readSandboxResponse(response);
      saveSession(nextSession);
    } catch (restartError) {
      setError(getErrorMessage(restartError));
    } finally {
      setIsRestarting(false);
    }
  }

  async function checkPreview() {
    if (!session || isCheckingPreview) return;

    setError(null);
    setIsCheckingPreview(true);

    try {
      const response = await fetch(checkPreviewAction, {
        body: JSON.stringify({ sessionId: session.sessionId }),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const nextSession = await readSandboxResponse(response);
      saveSession(nextSession);
    } catch (checkError) {
      setError(getErrorMessage(checkError));
    } finally {
      setIsCheckingPreview(false);
    }
  }

  async function stop() {
    if (!session || isStopping) return;

    setError(null);
    setIsStopping(true);

    try {
      const response = await fetch(stopAction, {
        body: JSON.stringify({
          environmentId: session.environmentId,
          sessionId: session.sessionId,
        }),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const nextSession = await readSandboxResponse(response);
      saveSession(nextSession);
      clearSavedSession();
    } catch (stopError) {
      setError(getErrorMessage(stopError));
    } finally {
      setIsStopping(false);
    }
  }

  return {
    checkPreview,
    error,
    isCheckingPreview,
    isRestarting,
    isStarting,
    isStopping,
    phase,
    restartPreview,
    session,
    start,
    status,
    statusMessage,
    stop,
  };
}

export type IssueSandboxSessionState = ReturnType<typeof useIssueSandboxSession>;
