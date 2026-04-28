"use client";

import { useRouter } from "next/navigation";
import { Eye, FileCode2, RefreshCw } from "lucide-react";
import { structuredPatch, type StructuredPatchHunk } from "diff";

import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { cn } from "~/lib/utils";

type IssueChangePreviewModalProps = {
  filePath?: string;
  model?: string;
  originalContent?: string;
  summary?: string;
  updatedContent?: string;
};

type PreparedChangePreview = Required<Pick<
  IssueChangePreviewModalProps,
  "filePath" | "originalContent" | "updatedContent"
>>;

type DiffRow = {
  code: string;
  key: string;
  marker: string;
  newLine?: number;
  oldLine?: number;
  type: "added" | "context" | "hunk" | "note" | "removed";
};

function hasPreparedChange(
  input: IssueChangePreviewModalProps,
): input is IssueChangePreviewModalProps & PreparedChangePreview {
  return (
    typeof input.filePath === "string" &&
    typeof input.originalContent === "string" &&
    typeof input.updatedContent === "string"
  );
}

function getPatch(input: PreparedChangePreview) {
  return structuredPatch(
    input.filePath,
    input.filePath,
    input.originalContent,
    input.updatedContent,
    "",
    "",
    { context: 3 },
  );
}

function countChangedLines(hunks: StructuredPatchHunk[]) {
  return hunks.reduce(
    (counts, hunk) => {
      for (const line of hunk.lines) {
        if (line.startsWith("+")) {
          counts.added += 1;
        }

        if (line.startsWith("-")) {
          counts.removed += 1;
        }
      }

      return counts;
    },
    { added: 0, removed: 0 },
  );
}

function buildRows(hunks: StructuredPatchHunk[]) {
  return hunks.flatMap<DiffRow>((hunk, hunkIndex) => {
    let oldLine = hunk.oldStart;
    let newLine = hunk.newStart;
    const rows: DiffRow[] = [
      {
        code: `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
        key: `hunk-${hunkIndex}`,
        marker: "",
        type: "hunk",
      },
    ];

    hunk.lines.forEach((line, lineIndex) => {
      const marker = line[0] ?? " ";
      const code = marker === "\\" ? line : line.slice(1);
      const key = `hunk-${hunkIndex}-line-${lineIndex}`;

      if (marker === "+") {
        rows.push({
          code,
          key,
          marker,
          newLine,
          type: "added",
        });
        newLine += 1;
        return;
      }

      if (marker === "-") {
        rows.push({
          code,
          key,
          marker,
          oldLine,
          type: "removed",
        });
        oldLine += 1;
        return;
      }

      if (marker === "\\") {
        rows.push({
          code,
          key,
          marker,
          type: "note",
        });
        return;
      }

      rows.push({
        code,
        key,
        marker: " ",
        newLine,
        oldLine,
        type: "context",
      });
      oldLine += 1;
      newLine += 1;
    });

    return rows;
  });
}

const rowStyles: Record<DiffRow["type"], string> = {
  added: "border-l-2 border-emerald-400 bg-emerald-500/14 text-emerald-50",
  context: "border-l-2 border-transparent text-slate-300",
  hunk: "border-l-2 border-slate-700 bg-slate-800/80 text-slate-400",
  note: "border-l-2 border-amber-400/60 bg-amber-500/10 text-amber-100",
  removed: "border-l-2 border-red-400 bg-red-500/16 text-red-50",
};

export function IssueChangePreviewModal(props: IssueChangePreviewModalProps) {
  const router = useRouter();
  const hasChange = hasPreparedChange(props);
  const patch = hasChange ? getPatch(props) : null;
  const counts = patch ? countChangedLines(patch.hunks) : { added: 0, removed: 0 };
  const rows = patch ? buildRows(patch.hunks) : [];

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="rounded-full border-border px-4 text-[10px] font-bold uppercase tracking-[0.22em]"
        >
          <Eye className="h-3.5 w-3.5" />
          Preview Changes
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="!inset-y-auto !right-auto !left-1/2 !top-1/2 !h-[min(45rem,calc(100vh-2rem))] !w-[min(70rem,calc(100vw-2rem))] !max-w-none !-translate-x-1/2 !-translate-y-1/2 overflow-hidden rounded-[1.5rem] border border-slate-700 bg-[#070b12] p-0 text-slate-100 shadow-[0_24px_90px_rgba(0,0,0,0.6)]"
      >
        <SheetHeader className="border-b border-slate-800 px-5 py-4">
          <SheetDescription className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
            <FileCode2 className="h-3.5 w-3.5" />
            Development Preview
          </SheetDescription>
          <div className="flex flex-wrap items-start justify-between gap-3 pr-10">
            <div className="min-w-0">
              <SheetTitle className="truncate font-mono text-sm font-semibold text-slate-100">
                {props.filePath ?? "No prepared change"}
              </SheetTitle>
              {props.summary ? (
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {props.summary}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-3 font-mono text-xs">
              <span className="text-emerald-400">+{counts.added}</span>
              <span className="text-red-400">-{counts.removed}</span>
            </div>
          </div>
          {props.model ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
              Prepared with {props.model}
            </p>
          ) : null}
        </SheetHeader>

        <div className="h-full min-h-0 overflow-auto pb-16">
          {rows.length > 0 ? (
            <div className="min-w-max font-mono text-[13px] leading-6">
              {rows.map((row) => (
                <div
                  key={row.key}
                  className={cn(
                    "grid grid-cols-[4rem_4rem_2rem_minmax(38rem,1fr)]",
                    rowStyles[row.type],
                  )}
                >
                  <span className="select-none border-r border-slate-800/80 px-3 text-right text-slate-500">
                    {row.oldLine ?? ""}
                  </span>
                  <span className="select-none border-r border-slate-800/80 px-3 text-right text-slate-500">
                    {row.newLine ?? ""}
                  </span>
                  <span className="select-none border-r border-slate-800/80 text-center">
                    {row.marker}
                  </span>
                  <code className="whitespace-pre px-3 text-left">
                    {row.code || " "}
                  </code>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full min-h-[24rem] items-center justify-center px-6">
              <div className="max-w-md border border-slate-800 bg-slate-950/60 px-6 py-5 text-center">
                <p className="text-sm font-medium text-slate-200">
                  No prepared change loaded yet.
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  If the agent just prepared an edit, refresh the server snapshot so
                  this preview can read the latest pending change.
                </p>
                <Button
                  className="mt-5 rounded-full border-slate-700 bg-transparent text-slate-100 hover:bg-slate-900"
                  onClick={() => {
                    router.refresh();
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh Preview
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
