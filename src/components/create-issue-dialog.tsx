"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CirclePlus, LoaderCircle } from "lucide-react";

import { Button } from "~/components/ui/button";
import { getProjectIssuesRefreshKey } from "~/components/project-issues-refresh-on-return";
import { cn } from "~/lib/utils";

type CreateIssueDialogProps = {
  projectId: string;
};

type CreateIssueResponse =
  | {
      issue: { number: number; title: string; url: string };
      ok: true;
    }
  | {
      error: string;
      ok: false;
    };

export function CreateIssueDialog({ projectId }: CreateIssueDialogProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openDialog() {
    setTitle("");
    setDescription("");
    setError(null);
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedTitle = title.trim();

    if (!trimmedTitle || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/issues`, {
        body: JSON.stringify({ description: description.trim() || undefined, title: trimmedTitle }),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const result = (await response.json()) as CreateIssueResponse;

      if (!result.ok) {
        setError((result as { error: string; ok: false }).error);
        return;
      }

      closeDialog();
      window.sessionStorage.setItem(
        getProjectIssuesRefreshKey(projectId),
        "true",
      );
      router.push(`/projects/${projectId}/issues/${result.issue.number}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Button
        className="h-9 rounded-md px-4 text-xs font-medium"
        id="new-issue-button"
        onClick={openDialog}
        type="button"
      >
        <CirclePlus className="mr-1.5 h-3.5 w-3.5" />
        New Issue
      </Button>

      {/* Native dialog — no portal, no library needed */}
      <dialog
        ref={dialogRef}
        className={cn(
          "m-auto w-full max-w-lg rounded-xl border border-border bg-background p-0 text-foreground shadow-2xl",
          "backdrop:bg-black/60 backdrop:backdrop-blur-sm",
          "open:animate-in open:fade-in-0 open:zoom-in-95",
        )}
        onClick={(e) => {
          // Close when clicking the backdrop
          if (e.target === dialogRef.current) closeDialog();
        }}
        onClose={() => {
          if (isSubmitting) return;
        }}
      >
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="text-sm font-semibold tracking-tight">
              Create New Issue
            </h2>
            <button
              aria-label="Close"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              disabled={isSubmitting}
              onClick={closeDialog}
              type="button"
            >
              <span aria-hidden className="text-base leading-none">×</span>
            </button>
          </div>

          {/* Body */}
          <div className="space-y-4 px-6 py-5">
            {/* Title */}
            <div className="space-y-1.5">
              <label
                className="text-xs font-medium text-foreground"
                htmlFor="issue-title"
              >
                Title <span className="text-destructive">*</span>
              </label>
              <input
                autoFocus
                className={cn(
                  "w-full rounded-md border border-border bg-muted/40 px-3 py-2 text-sm outline-none",
                  "placeholder:text-muted-foreground/60",
                  "focus:border-primary focus:ring-1 focus:ring-primary/30",
                  "transition-colors",
                )}
                disabled={isSubmitting}
                id="issue-title"
                maxLength={256}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short, descriptive title"
                required
                type="text"
                value={title}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label
                className="text-xs font-medium text-foreground"
                htmlFor="issue-description"
              >
                Description{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </label>
              <textarea
                className={cn(
                  "w-full rounded-md border border-border bg-muted/40 px-3 py-2 text-sm outline-none",
                  "placeholder:text-muted-foreground/60",
                  "focus:border-primary focus:ring-1 focus:ring-primary/30",
                  "min-h-[100px] resize-y transition-colors",
                )}
                disabled={isSubmitting}
                id="issue-description"
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue, steps to reproduce, expected behaviour…"
                rows={4}
                value={description}
              />
            </div>

            {/* Error */}
            {error ? (
              <p className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            ) : null}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
            <Button
              disabled={isSubmitting}
              onClick={closeDialog}
              type="button"
              variant="ghost"
              className="h-9 rounded-md px-4 text-xs"
            >
              Cancel
            </Button>
            <Button
              className="h-9 rounded-md px-4 text-xs font-medium"
              disabled={isSubmitting || !title.trim()}
              id="create-issue-submit"
              type="submit"
            >
              {isSubmitting ? (
                <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CirclePlus className="mr-1.5 h-3.5 w-3.5" />
              )}
              {isSubmitting ? "Creating…" : "Create Issue"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
