"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Bug,
  ChevronDown,
  Copy,
  ExternalLink,
  Globe,
  LoaderCircle,
  MoreHorizontal,
  PanelLeftOpen,
  RefreshCw,
  Square,
  Terminal,
} from "lucide-react";
import { toast } from "sonner";

import { IssuePreviewStage } from "~/components/issue-preview-stage";
import { ModeToggle } from "~/components/mode-toggle";
import { useSidebar } from "~/components/issue-workspace-layout";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  type IssueSandboxActions,
  type IssueSandboxPhase,
  type IssueSandboxSessionState,
  useIssueSandboxSession,
} from "~/components/use-issue-sandbox-session";
import { cn } from "~/lib/utils";

const phaseCopy: Record<IssueSandboxPhase, string> = {
  idle: "Not started",
  booting: "Starting",
  running: "Live",
  stopped: "Stopped",
  failed: "Error",
  unsupported: "Unsupported",
};

const phaseStyles: Record<IssueSandboxPhase, string> = {
  idle: "border-[#171713]/20 bg-[#171713]/[0.035] text-[#6d675d] dark:border-white/15 dark:bg-white/[0.05] dark:text-[#aaa69d]",
  booting: "border-cyan-600/25 bg-cyan-600/10 text-cyan-700 dark:border-cyan-300/30 dark:bg-cyan-300/10 dark:text-cyan-200",
  running: "border-emerald-600/25 bg-emerald-600/10 text-emerald-700 dark:border-emerald-300/30 dark:bg-emerald-300/10 dark:text-emerald-200",
  stopped: "border-[#171713]/20 bg-[#171713]/[0.035] text-[#6d675d] dark:border-white/15 dark:bg-white/[0.05] dark:text-[#aaa69d]",
  failed: "border-red-600/25 bg-red-600/10 text-red-700 dark:border-red-300/30 dark:bg-red-300/10 dark:text-red-200",
  unsupported: "border-red-600/25 bg-red-600/10 text-red-700 dark:border-red-300/30 dark:bg-red-300/10 dark:text-red-200",
};

const phaseFallbackMessage: Record<IssueSandboxPhase, string> = {
  idle: "Start the preview to see your app live.",
  booting: "Getting your preview ready",
  running: "Preview ready",
  stopped: "The preview is stopped.",
  failed: "The preview couldn't start.",
  unsupported: "This project isn't supported yet.",
};

const toolbarIconButtonClass =
  "h-7 w-7 text-[#6d675d] hover:bg-[#171713]/5 hover:text-[#171713] dark:text-[#aaa69d] dark:hover:bg-white/5 dark:hover:text-[#fffaf0]";

function PreviewMenu({
  onOpenLogs,
  sandbox,
}: {
  onOpenLogs: () => void;
  sandbox: IssueSandboxSessionState;
}) {
  const {
    checkPreview,
    isCheckingPreview,
    isRestarting,
    isStopping,
    phase,
    restartPreview,
    session,
    stop,
  } = sandbox;
  const isBusy = isCheckingPreview || isRestarting || isStopping;

  if (!session || (phase !== "running" && phase !== "booting")) {
    return null;
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Preview options"
          className={toolbarIconButtonClass}
          size="icon"
          type="button"
          variant="ghost"
        >
          {isBusy ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <MoreHorizontal className="h-3.5 w-3.5" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {phase === "running" ? (
          <DropdownMenuItem
            disabled={isBusy}
            onClick={() => void checkPreview()}
          >
            <Bug className="h-3.5 w-3.5" />
            {isCheckingPreview ? "Checking for errors" : "Check for errors"}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          disabled={session.logs.length === 0}
          onClick={onOpenLogs}
        >
          <Terminal className="h-3.5 w-3.5" />
          View logs
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isBusy}
          onClick={() => void restartPreview()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {isRestarting ? "Restarting preview" : "Restart preview"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isBusy}
          onClick={() => void stop()}
          variant="destructive"
        >
          <Square className="h-3.5 w-3.5" />
          {isStopping ? "Stopping preview" : "Stop preview"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PreviewErrorBanner({ sandbox }: { sandbox: IssueSandboxSessionState }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { isRestarting, restartPreview, session } = sandbox;

  if (!session?.previewError) return null;

  return (
    <div className="shrink-0 border-b border-destructive/30 bg-destructive/[0.06]">
      <div className="flex items-center gap-3 px-4 py-2">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />
        <p className="min-w-0 flex-1 truncate text-xs text-[#171713] dark:text-[#fffaf0]">
          <span className="font-semibold">The preview hit an error.</span>{" "}
          <span className="text-[#6d675d] dark:text-[#aaa69d]">
            {session.previewError.split("\n")[0]}
          </span>
        </p>
        <Button
          className="h-7 rounded-none px-2 text-xs"
          onClick={() => setIsExpanded((expanded) => !expanded)}
          size="sm"
          type="button"
          variant="ghost"
        >
          Details
          <ChevronDown
            className={cn("ml-1 h-3 w-3 transition-transform", isExpanded && "rotate-180")}
          />
        </Button>
        <Button
          className="h-7 rounded-none px-2 text-xs"
          disabled={isRestarting}
          onClick={() => void restartPreview()}
          size="sm"
          type="button"
          variant="outline"
        >
          {isRestarting ? (
            <LoaderCircle className="mr-1.5 h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="mr-1.5 h-3 w-3" />
          )}
          Restart preview
        </Button>
      </div>
      {isExpanded ? (
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words border-t border-destructive/20 px-4 py-3 font-mono text-[11px] leading-relaxed text-destructive">
          {session.previewError}
        </pre>
      ) : null}
    </div>
  );
}

export function IssuePreviewPane(actions: IssueSandboxActions) {
  const sandbox = useIssueSandboxSession(actions);
  const { isOpen: isSidebarOpen, setIsOpen: setIsSidebarOpen } = useSidebar();
  const { error, phase, session, statusMessage } = sandbox;
  const [iframeKey, setIframeKey] = useState(0);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const previewUrl = phase === "running" ? session?.previewUrl ?? null : null;

  async function handleCopyPreviewLink() {
    if (!previewUrl) return;

    try {
      await navigator.clipboard.writeText(previewUrl);
      toast.success("Preview link copied.");
    } catch {
      toast.error("Could not copy preview link.");
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-[#f3efe5] text-[#171713] dark:bg-[#201f1a] dark:text-[#fffaf0]">
      <header className="relative flex h-14 shrink-0 items-center gap-2 border-b border-[#171713]/15 bg-[#fffaf0]/75 px-4 after:absolute after:bottom-[-1px] after:left-4 after:h-px after:w-14 after:bg-[#f04f2f] dark:border-white/10 dark:bg-[#171713]">
        {!isSidebarOpen ? (
          <Button
            aria-label="Show chat"
            className="h-7 w-7 shrink-0 rounded-none text-[#6d675d] hover:bg-[#f04f2f] hover:text-white dark:text-[#aaa69d]"
            onClick={() => setIsSidebarOpen(true)}
            size="icon"
            type="button"
            variant="ghost"
          >
            <PanelLeftOpen className="h-3.5 w-3.5" />
          </Button>
        ) : null}
        <span
          className={cn(
            "shrink-0 rounded-none border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em]",
            phaseStyles[phase],
          )}
        >
          {phaseCopy[phase]}
        </span>

        {previewUrl ? (
          <>
            <Button
              aria-label="Refresh preview"
              className={toolbarIconButtonClass}
              onClick={() => setIframeKey((key) => key + 1)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <div className="flex min-w-0 flex-1 items-center gap-2 border border-[#171713]/15 bg-[#f3efe5]/70 px-2.5 py-1 dark:border-white/10 dark:bg-white/[0.04]">
              <Globe className="h-3 w-3 shrink-0 text-[#f04f2f]" />
              <span className="truncate font-mono text-[11px] text-[#6d675d] select-all dark:text-[#aaa69d]">
                {previewUrl}
              </span>
            </div>
            <Button
              aria-label="Copy preview link"
              className={toolbarIconButtonClass}
              onClick={handleCopyPreviewLink}
              size="icon"
              type="button"
              variant="ghost"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button
              asChild
              className={toolbarIconButtonClass}
              size="icon"
              variant="ghost"
            >
              <a href={previewUrl} rel="noreferrer" target="_blank">
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="sr-only">Open in new tab</span>
              </a>
            </Button>
          </>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="truncate text-xs font-medium text-[#171713] dark:text-[#fffaf0]">
              {statusMessage ?? phaseFallbackMessage[phase]}
            </p>
            {error ? (
              <p className="truncate text-[10px] text-destructive">{error}</p>
            ) : null}
          </div>
        )}

        <PreviewMenu onOpenLogs={() => setIsLogsOpen(true)} sandbox={sandbox} />
        <div className="ml-1 shrink-0 border-l border-[#171713]/10 pl-2 dark:border-white/10 [&_button]:text-[#6d675d] dark:[&_button]:text-[#aaa69d] [&_button:hover]:bg-[#171713]/5 dark:[&_button:hover]:bg-white/5 [&_button:hover]:text-[#171713] dark:[&_button:hover]:text-[#fffaf0]">
          <ModeToggle />
        </div>
      </header>

      {previewUrl ? (
        <>
          <PreviewErrorBanner sandbox={sandbox} />
          <div className="flex-1 min-h-0">
            <iframe
              key={iframeKey}
              src={previewUrl}
              className="h-full w-full border-0"
              title="Sandbox preview"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              allow="clipboard-read; clipboard-write"
            />
          </div>
        </>
      ) : (
        <IssuePreviewStage sandbox={sandbox} />
      )}

      <Dialog open={isLogsOpen} onOpenChange={setIsLogsOpen}>
        <DialogContent className="gap-0 rounded-none border-white/10 bg-zinc-950 p-0 text-zinc-100 sm:max-w-2xl">
          <DialogHeader className="border-b border-white/10 px-4 py-3">
            <DialogTitle className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-300">
              <span className="h-1.5 w-1.5 bg-emerald-400" />
              Sandbox logs
              <span className="font-mono font-normal normal-case tracking-normal text-zinc-500">
                {session?.logs.length ?? 0} {session?.logs.length === 1 ? "line" : "lines"}
              </span>
            </DialogTitle>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[11px] leading-5 text-zinc-300">
            {session?.logs.join("")}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
