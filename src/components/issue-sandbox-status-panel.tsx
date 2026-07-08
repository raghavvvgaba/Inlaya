"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bug,
  ExternalLink,
  LoaderCircle,
  Play,
  RefreshCw,
  Square,
} from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { ModeToggle } from "~/components/mode-toggle";
import { sandboxSessionUpdatedEvent } from "~/lib/sandbox-events";
import { cn } from "~/lib/utils";

type SandboxStatus = "starting" | "installing" | "running" | "stopped" | "error";
type PreviewState = "ready" | "recovering" | "stale" | "offline";
type StartupStage =
  | "creating"
  | "scaffolding"
  | "installing"
  | "seeding"
  | "starting-preview"
  | "ready"
  | "error";

type SandboxSession = {
  endAt?: string;
  environmentId: string;
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

type IssueSandboxStatusPanelProps = {
  checkPreviewAction: string;
  heartbeatAction: string;
  onPreviewUrlChange?: (previewUrl: string | null) => void;
  projectId: string;
  restartPreviewAction: string;
  sessionAction: string;
  startAction: string;
  stopAction: string;
};

const ACTIVE_STATUSES = new Set<SandboxStatus>([
  "starting",
  "installing",
  "running",
]);
const POLL_INTERVAL_MS = 2500;
const HEARTBEAT_INTERVAL_MS = 30_000;

const statusCopy: Record<SandboxStatus, string> = {
  starting: "Starting",
  installing: "Installing",
  running: "Running",
  stopped: "Stopped",
  error: "Error",
};

const statusStyles: Record<SandboxStatus, string> = {
  starting: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-100",
  installing: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-100",
  running: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-100",
  stopped: "border-border bg-muted text-muted-foreground",
  error: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-100",
};

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

export function IssueSandboxStatusPanel({
  checkPreviewAction,
  heartbeatAction,
  onPreviewUrlChange,
  projectId,
  restartPreviewAction,
  sessionAction,
  startAction,
  stopAction,
}: IssueSandboxStatusPanelProps) {
  const storageKey = useMemo(() => `devin:sandbox:${projectId}`, [projectId]);
  const [session, setSession] = useState<SandboxSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isCheckingPreview, setIsCheckingPreview] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const isActive = session ? ACTIVE_STATUSES.has(session.status) : false;
  const canStart = !session || session.status === "stopped" || session.status === "error";
  const canOpenPreview =
    session?.status === "running" && session.previewState === "ready";
  const status = session?.status ?? "stopped";
  const statusMessage =
    session?.status === "stopped" || session?.status === "error"
      ? session.message ?? session.startupMessage
      : session?.previewMessage ?? session?.startupMessage ?? session?.message;
  const displayMessage =
    statusMessage ?? "Start a preview environment for this issue.";

  // Notify parent when preview URL availability changes
  useEffect(() => {
    if (onPreviewUrlChange) {
      onPreviewUrlChange(canOpenPreview && session?.previewUrl ? session.previewUrl : null);
    }
  }, [canOpenPreview, session?.previewUrl, onPreviewUrlChange]);

  const saveSession = useCallback(
    (nextSession: SandboxSession) => {
      setSession(nextSession);

      if (nextSession.status === "stopped") {
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

  async function handleStart() {
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

  async function handleRestartPreview() {
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

  async function handleCheckPreview() {
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

  async function handleStop() {
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

  return (
    <div className="flex w-full items-center justify-between gap-4">
      {/* Left side: Status and Real-time message */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className={cn(
            "shrink-0 rounded-none border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em]",
            statusStyles[status],
          )}
        >
          {statusCopy[status]}
        </span>
        
        {/* Ticker / Current Message */}
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate text-xs font-medium text-foreground">
            {displayMessage}
          </p>
          {session?.previewUrl && canOpenPreview ? (
            <p className="truncate font-mono text-[10px] text-muted-foreground">
              {session.previewUrl}
            </p>
          ) : error ? (
            <p className="truncate text-[10px] text-destructive">
              {error}
            </p>
          ) : (session?.logs && session.logs.length > 0) ? (
            <p className="truncate font-mono text-[10px] text-muted-foreground">
              {session.logs[session.logs.length - 1]?.trim() || "Waiting for logs..."}
            </p>
          ) : null}
        </div>
      </div>

      {/* Right side: Controls */}
      <div className="flex shrink-0 items-center gap-2">
        {session?.previewError ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="h-8 rounded-none border-destructive/40 px-2 text-xs text-destructive"
                size="sm"
                type="button"
                variant="outline"
              >
                <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
                Error
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-[360px] rounded-none border-border p-0"
            >
              <DropdownMenuLabel className="border-b border-border px-3 py-2 text-[10px] font-bold uppercase tracking-widest">
                Preview Error
              </DropdownMenuLabel>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-[11px] leading-relaxed text-destructive">
                {session.previewError}
              </pre>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        {canStart ? (
          <Button
            className="h-8 rounded-none text-xs"
            disabled={isStarting}
            onClick={handleStart}
            size="sm"
            type="button"
          >
            {isStarting ? (
              <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="mr-1.5 h-3.5 w-3.5" />
            )}
            {isStarting ? "Starting" : "Start"}
          </Button>
        ) : null}

        {session?.previewUrl && canOpenPreview ? (
          <Button
            asChild
            size="sm"
            variant="secondary"
            className="h-8 rounded-none text-xs"
          >
            <a href={session.previewUrl} rel="noreferrer" target="_blank">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Preview
            </a>
          </Button>
        ) : null}

        {session && session.status === "running" ? (
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-none text-xs"
            disabled={isCheckingPreview || isRestarting || isStopping}
            onClick={handleCheckPreview}
            type="button"
          >
            {isCheckingPreview ? (
              <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Bug className="mr-1.5 h-3.5 w-3.5" />
            )}
            {isCheckingPreview ? "Checking" : "Check"}
          </Button>
        ) : null}

        {session?.previewUrl && !canOpenPreview && session.status !== "stopped" ? (
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-none text-xs text-muted-foreground"
            disabled
            type="button"
          >
            <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            Wait
          </Button>
        ) : null}

        {session && session.status !== "stopped" ? (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-none text-xs"
              disabled={isRestarting || isStopping}
              onClick={handleRestartPreview}
              type="button"
            >
              {isRestarting ? (
                <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              )}
              {isRestarting ? "Restarting" : "Restart"}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-8 rounded-none text-xs"
              disabled={isStopping || isRestarting}
              onClick={handleStop}
              type="button"
            >
              {isStopping ? (
                <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Square className="mr-1.5 h-3.5 w-3.5" />
              )}
              {isStopping ? "Stopping" : "Stop"}
            </Button>
          </>
        ) : null}
        <ModeToggle />
      </div>
    </div>
  );
}
