"use client";

import { useCallback, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Globe,
  Monitor,
  RefreshCw,
} from "lucide-react";

import { IssueSandboxStatusPanel } from "~/components/issue-sandbox-status-panel";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

type IssuePreviewPaneProps = {
  heartbeatAction: string;
  projectId: string;
  restartPreviewAction: string;
  sessionAction: string;
  startAction: string;
  stopAction: string;
};

export function IssuePreviewPane({
  heartbeatAction,
  projectId,
  restartPreviewAction,
  sessionAction,
  startAction,
  stopAction,
}: IssuePreviewPaneProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);

  const handlePreviewUrlChange = useCallback((url: string | null) => {
    setPreviewUrl(url);
  }, []);

  function handleRefreshPreview() {
    setIframeKey((k) => k + 1);
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-muted/20">
      {/* Status Panel Header */}
      <header className="flex h-14 shrink-0 items-center border-b border-border bg-background px-4">
        <IssueSandboxStatusPanel
          heartbeatAction={heartbeatAction}
          onPreviewUrlChange={handlePreviewUrlChange}
          projectId={projectId}
          restartPreviewAction={restartPreviewAction}
          sessionAction={sessionAction}
          startAction={startAction}
          stopAction={stopAction}
        />
      </header>

      {/* Preview Area */}
      {previewUrl ? (
        <div className="flex flex-1 flex-col min-h-0">
          {/* Browser Chrome */}
          <div className="flex h-10 shrink-0 items-center gap-1.5 border-b border-border bg-background/80 px-3">
            {/* Navigation buttons */}
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                disabled
                type="button"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                disabled
                type="button"
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={handleRefreshPreview}
                type="button"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Address bar */}
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-sm border border-border bg-muted/50 px-2.5 py-1">
              <Globe className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="truncate font-mono text-[11px] text-muted-foreground select-all">
                {previewUrl}
              </span>
            </div>

            {/* Open in new tab */}
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
            >
              <a href={previewUrl} rel="noreferrer" target="_blank">
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="sr-only">Open in new tab</span>
              </a>
            </Button>
          </div>

          {/* Iframe */}
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
        </div>
      ) : (
        /* Empty state - no preview URL */
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-center text-muted-foreground">
            <div className={cn(
              "flex h-12 w-12 items-center justify-center rounded-xl",
              "border border-dashed border-muted-foreground/25 bg-muted/30"
            )}>
              <Monitor className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <div>
              <p className="text-sm font-medium">No preview available</p>
              <p className="mt-0.5 text-xs text-muted-foreground/70">
                Start the sandbox to see a live preview here.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
