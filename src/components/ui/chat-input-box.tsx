"use client";

import { useEffect, useRef } from "react";
import { ArrowUp, LoaderCircle, Sparkles } from "lucide-react";

import { Button } from "~/components/ui/button";

type ChatInputBoxProps = {
  accessBlocked?: boolean;
  instruction: string;
  isPreparing?: boolean;
  onInstructionChange: (value: string) => void;
  onPrepareEdit: () => void;
};

export function ChatInputBox({
  accessBlocked = false,
  instruction,
  isPreparing = false,
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
        <div className="rounded-[1.35rem] border border-white/10 bg-black/30 px-3 py-2">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
            <Sparkles className="h-3.5 w-3.5" />
            Agent Instruction
          </div>
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
            placeholder="Describe what you want Devin to change in the sandbox."
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
              {isPreparing ? "Working" : "Run Agent"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
