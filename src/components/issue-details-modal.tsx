"use client";

import { FileText } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";

type IssueDetailsModalProps = {
  author?: string;
  body: string | null;
  comments?: number;
  createdAt?: string;
  issueNumber: number;
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
          className="rounded-full border-border px-4 text-[10px] font-bold uppercase tracking-[0.22em]"
        >
          <FileText className="h-3.5 w-3.5" />
          View Issue
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="!inset-y-auto !right-auto !left-1/2 !top-1/2 !h-auto !w-[min(46rem,calc(100vw-2rem))] !max-w-none !-translate-x-1/2 !-translate-y-1/2 rounded-[2rem] border border-border bg-background p-0"
      >
        <SheetHeader className="border-b border-border px-6 py-5">
          <SheetDescription className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Issue #{issueNumber}
          </SheetDescription>
          <SheetTitle className="pr-10 text-xl font-bold uppercase tracking-tight">
            {title}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 px-6 py-6">
          <div className="flex flex-wrap gap-2">
            {author ? (
              <span className="rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                @{author}
              </span>
            ) : null}
            {state ? (
              <span className="rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {state}
              </span>
            ) : null}
            {typeof comments === "number" ? (
              <span className="rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
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

          <div className="rounded-[1.5rem] border border-border bg-muted/30 px-5 py-4">
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
