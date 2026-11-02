"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  LoaderCircle,
  Monitor,
  Play,
  RotateCcw,
} from "lucide-react";

import { Button } from "~/components/ui/button";
import type {
  IssueSandboxSessionState,
  SandboxSession,
} from "~/components/use-issue-sandbox-session";
import { cn } from "~/lib/utils";

const STARTUP_STEPS = [
  "Setting up a private workspace",
  "Copying your project",
  "Figuring out what kind of project it is",
  "Installing what your project needs",
  "Starting the preview",
];

const MAX_VISIBLE_LOG_LINES = 200;

function getStartupStepIndex(session: SandboxSession | null) {
  switch (session?.startupStage) {
    case "scaffolding":
      return 1;
    case "installing":
      return session.startupMessage?.toLowerCase().includes("detecting") ? 2 : 3;
    case "seeding":
      return 3;
    case "starting-preview":
      return 4;
    case "ready":
      return STARTUP_STEPS.length;
    default:
      return 0;
  }
}

function SandboxLogs({ logs }: { logs: string[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const logRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (isOpen && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [isOpen, logs]);

  if (logs.length === 0) return null;

  return (
    <div className="w-full">
      <button
        className="mx-auto flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#777167] hover:text-[#171713] dark:text-[#817e75] dark:hover:text-[#fffaf0]"
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        {isOpen ? "Hide details" : "Show details"}
        <ChevronDown
          className={cn("h-3 w-3 transition-transform", isOpen && "rotate-180")}
        />
      </button>
      {isOpen ? (
        <pre
          ref={logRef}
          className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-words border border-white/10 bg-zinc-950 p-3 text-left font-mono text-[11px] leading-5 text-zinc-300"
        >
          {logs.slice(-MAX_VISIBLE_LOG_LINES).join("")}
        </pre>
      ) : null}
    </div>
  );
}

function StageFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
      <div className="absolute h-72 w-72 rotate-45 border border-[#171713]/[0.07] dark:border-white/[0.06]" />
      <div className="relative flex w-full max-w-md flex-col items-center gap-5 text-center text-[#6d675d] dark:text-[#aaa69d]">
        {children}
      </div>
    </div>
  );
}

function StageIcon({
  children,
  tone = "accent",
}: {
  children: React.ReactNode;
  tone?: "accent" | "destructive";
}) {
  return (
    <div
      className={cn(
        "flex h-14 w-14 items-center justify-center border",
        tone === "accent"
          ? "border-[#f04f2f]/35 bg-[#f04f2f]/10 text-[#f04f2f]"
          : "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      {children}
    </div>
  );
}

function StageCopy({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-[#171713] dark:text-[#fffaf0]">{title}</p>
      <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-[#777167] dark:text-[#817e75]">
        {body}
      </p>
    </div>
  );
}

function StartButton({
  isStarting,
  label,
  onStart,
}: {
  isStarting: boolean;
  label: string;
  onStart: () => void;
}) {
  return (
    <Button
      className="h-10 rounded-none bg-[#171713] px-5 text-xs font-semibold text-[#fffaf0] hover:bg-[#f04f2f] hover:text-white dark:bg-[#fffaf0] dark:text-[#171713]"
      disabled={isStarting}
      onClick={onStart}
      type="button"
    >
      {isStarting ? (
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
      ) : label === "Try again" ? (
        <RotateCcw className="mr-2 h-4 w-4" />
      ) : (
        <Play className="mr-2 h-4 w-4" />
      )}
      {isStarting ? "Starting" : label}
    </Button>
  );
}

function RequestError({ error }: { error: string | null }) {
  if (!error) return null;

  return <p className="text-xs text-destructive">{error}</p>;
}

function BootingStage({ sandbox }: { sandbox: IssueSandboxSessionState }) {
  const { session, statusMessage } = sandbox;

  // A running sandbox whose preview dropped out is recovering, not booting
  // from scratch, so the startup checklist would be misleading.
  if (session?.status === "running") {
    return (
      <StageFrame>
        <LoaderCircle className="h-7 w-7 animate-spin text-[#f04f2f]" />
        <StageCopy
          title="Reconnecting the preview"
          body={statusMessage ?? "This usually takes a few seconds."}
        />
        <SandboxLogs logs={session.logs} />
      </StageFrame>
    );
  }

  const activeIndex = getStartupStepIndex(session);

  return (
    <StageFrame>
      <StageCopy
        title="Getting your preview ready"
        body="This usually takes a minute or two."
      />
      <ol className="w-full border border-[#171713]/15 bg-[#fffaf0]/70 text-left dark:border-white/10 dark:bg-[#171713]/70">
        {STARTUP_STEPS.map((label, index) => {
          const isDone = index < activeIndex;
          const isCurrent = index === activeIndex;

          return (
            <li
              key={label}
              className={cn(
                "flex items-start gap-3 border-b border-[#171713]/10 px-4 py-3 last:border-b-0 dark:border-white/10",
                !isDone && !isCurrent && "opacity-50",
              )}
            >
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                {isDone ? (
                  <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                ) : isCurrent ? (
                  <LoaderCircle className="h-4 w-4 animate-spin text-[#f04f2f]" />
                ) : (
                  <span className="h-1.5 w-1.5 bg-[#171713]/30 dark:bg-white/30" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-xs",
                    isCurrent
                      ? "font-semibold text-[#171713] dark:text-[#fffaf0]"
                      : "text-[#6d675d] dark:text-[#aaa69d]",
                  )}
                >
                  {label}
                </span>
                {isCurrent && session?.startupMessage ? (
                  <span className="mt-0.5 block truncate font-mono text-[10px] text-[#777167] dark:text-[#817e75]">
                    {session.startupMessage}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
      <SandboxLogs logs={session?.logs ?? []} />
    </StageFrame>
  );
}

export function IssuePreviewStage({
  sandbox,
}: {
  sandbox: IssueSandboxSessionState;
}) {
  const { error, isStarting, phase, session, start, statusMessage } = sandbox;
  const handleStart = () => void start();

  switch (phase) {
    case "booting":
      return <BootingStage sandbox={sandbox} />;
    case "unsupported":
      return (
        <StageFrame>
          <StageIcon tone="destructive">
            <AlertTriangle className="h-5 w-5" />
          </StageIcon>
          <StageCopy
            title="This project isn't supported yet"
            body="Inlaya couldn't find a setup it knows how to run. The temporary workspace was cleaned up automatically."
          />
          {session?.failureMessage ? (
            <p className="w-full whitespace-pre-wrap border-l-2 border-destructive bg-destructive/[0.06] px-4 py-3 text-left text-xs leading-relaxed text-[#171713] dark:text-[#fffaf0]">
              {session.failureMessage}
            </p>
          ) : null}
          <StartButton isStarting={isStarting} label="Try again" onStart={handleStart} />
          <RequestError error={error} />
        </StageFrame>
      );
    case "failed":
      return (
        <StageFrame>
          <StageIcon tone="destructive">
            <AlertTriangle className="h-5 w-5" />
          </StageIcon>
          <StageCopy
            title="The preview couldn't start"
            body={
              session?.failureMessage ??
              statusMessage ??
              "Something went wrong while setting things up."
            }
          />
          <StartButton isStarting={isStarting} label="Try again" onStart={handleStart} />
          <RequestError error={error} />
          <SandboxLogs logs={session?.logs ?? []} />
        </StageFrame>
      );
    case "stopped":
      return (
        <StageFrame>
          <StageIcon>
            <Monitor className="h-5 w-5" />
          </StageIcon>
          <StageCopy
            title="Preview stopped"
            body={statusMessage ?? "Start it again whenever you're ready."}
          />
          <StartButton isStarting={isStarting} label="Start again" onStart={handleStart} />
          <RequestError error={error} />
        </StageFrame>
      );
    case "idle":
      return (
        <StageFrame>
          <StageIcon>
            <Monitor className="h-5 w-5" />
          </StageIcon>
          <StageCopy
            title="See your app live"
            body="Start a preview to get a live copy of your app. Inlaya sets everything up for you, which usually takes a minute or two."
          />
          <StartButton isStarting={isStarting} label="Start preview" onStart={handleStart} />
          <RequestError error={error} />
        </StageFrame>
      );
    case "running":
      return null;
  }
}
