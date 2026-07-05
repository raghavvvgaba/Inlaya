"use client";

import { ExternalLink, FileText, X } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "~/components/ui/sheet";

type IssueDetailsModalProps = {
  author?: string;
  body: string | null;
  comments?: number;
  createdAt?: string;
  issueNumber: number;
  githubUrl?: string;
  state?: string;
  title: string;
  updatedAt?: string;
};

function formatTimestamp(value?: string) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function IssueDetailsModal({
  author,
  body,
  comments,
  createdAt,
  githubUrl,
  issueNumber,
  state,
  title,
  updatedAt,
}: IssueDetailsModalProps) {
  const createdLabel = formatTimestamp(createdAt);
  const updatedLabel = formatTimestamp(updatedAt);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="rounded-none border-border px-4 text-[10px] font-bold uppercase tracking-[0.22em]"
        >
          <FileText className="h-3.5 w-3.5" />
          View Issue
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="!inset-y-auto !right-auto !left-1/2 !top-1/2 !h-auto !w-[min(46rem,calc(100vw-2rem))] !max-w-none !-translate-x-1/2 !-translate-y-1/2 rounded-none border border-border bg-background p-0"
      >
        <SheetHeader className="border-b border-border px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <SheetDescription className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Issue #{issueNumber}
              </SheetDescription>
              <SheetTitle className="text-xl font-bold uppercase tracking-tight">
                {title}
              </SheetTitle>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {githubUrl ? (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 rounded-none border-border px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
                >
                  <a href={githubUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    GitHub
                  </a>
                </Button>
              ) : null}
              <SheetClose asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 shrink-0 rounded-none border-border p-0 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </SheetClose>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 px-6 py-6">
          <div className="flex flex-wrap gap-2">
            {author ? (
              <span className="rounded-none border border-border bg-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                @{author}
              </span>
            ) : null}
            {state ? (
              <span className="rounded-none border border-border bg-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {state}
              </span>
            ) : null}
            {typeof comments === "number" ? (
              <span className="rounded-none border border-border bg-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {comments} comments
              </span>
            ) : null}
          </div>

          <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
            {createdLabel ? (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em]">
                  Opened
                </p>
                <p>{createdLabel}</p>
              </div>
            ) : null}
            {updatedLabel ? (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em]">
                  Updated
                </p>
                <p>{updatedLabel}</p>
              </div>
            ) : null}
          </div>

          <div className="rounded-none border border-border bg-muted/30 px-5 py-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Issue Details
            </p>
            <div className="whitespace-pre-wrap text-sm leading-7 text-foreground">
              {body?.trim()
                ? body
                : "No GitHub description is attached to this issue yet."}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
