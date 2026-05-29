"use client";

import { useEffect, useRef } from "react";
import { ArrowUp, FileCode2, LoaderCircle } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

type ChatInputBoxProps = {
  accessBlocked?: boolean;
  filePath: string;
  instruction: string;
  isPreparing?: boolean;
  onFilePathChange: (value: string) => void;
  onInstructionChange: (value: string) => void;
  onPrepareEdit: () => void;
};

export function ChatInputBox({
  accessBlocked = false,
  filePath,
  instruction,
  isPreparing = false,
  onFilePathChange,
  onInstructionChange,
  onPrepareEdit,
}: ChatInputBoxProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`;
  }, []);

  return (
    <div className="space-y-3">
      <div
        className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-2 shadow-[0_8px_30px_rgba(0,0,0,0.28)]"
      >
        <div className="mb-2 flex items-center gap-3 rounded-[1.15rem] border border-white/10 bg-black/30 px-3 py-1.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-white/70">
            <FileCode2 className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/45">
              File Section
            </p>
            <Input
              className="h-auto border-0 bg-transparent px-0 py-0 font-mono text-xs text-white shadow-none focus-visible:ring-0"
              disabled={accessBlocked || isPreparing}
              onChange={(event) => {
                onFilePathChange(event.target.value);
              }}
              placeholder="README.md"
              value={filePath}
              required
            />
          </div>
        </div>

        <div className="rounded-[1.35rem] border border-white/10 bg-black/30 px-3 py-2">
          <textarea
            ref={textareaRef}
            className="min-h-[48px] w-full resize-none bg-transparent text-sm leading-6 text-white outline-none placeholder:text-white/35"
            disabled={accessBlocked || isPreparing}
            onChange={(event) => {
              onInstructionChange(event.target.value);
            }}
            onInput={(event) => {
              const textarea = event.currentTarget;
              textarea.style.height = "0px";
              textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`;
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onPrepareEdit();
              }
            }}
            placeholder="Describe the change you want me to prepare for this issue."
            value={instruction}
            required
          />

          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <Button
              className="ml-auto h-8 rounded-full bg-white px-3 text-[11px] font-medium text-black hover:bg-white/85"
              disabled={accessBlocked || isPreparing}
              onClick={onPrepareEdit}
              type="button"
            >
              {isPreparing ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
              {isPreparing ? "Preparing" : "Prepare Edit"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
