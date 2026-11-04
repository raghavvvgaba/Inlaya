"use client";

import { useEffect, useRef } from "react";
import {
  ArrowUp,
  Hammer,
  ListTree,
  LoaderCircle,
} from "lucide-react";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import type { SandboxAgentMode } from "~/server/sandbox/types";

type ChatInputBoxProps = {
  accessBlocked?: boolean;
  instruction: string;
  isPreparing?: boolean;
  mode: SandboxAgentMode;
  onInstructionChange: (value: string) => void;
  onModeChange: (mode: SandboxAgentMode) => void;
  onPrepareEdit: () => void;
};

export function ChatInputBox({
  accessBlocked = false,
  instruction,
  isPreparing = false,
  mode,
  onInstructionChange,
  onModeChange,
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
    <div className="flex w-full flex-col border border-[#171713]/15 bg-[#f3efe5]/55 p-3 shadow-[5px_5px_0_rgba(23,23,19,0.05)] dark:border-[#fffaf0]/15 dark:bg-white/[0.035] dark:shadow-[5px_5px_0_rgba(240,79,47,0.08)]">
      <textarea
        ref={textareaRef}
        className="min-h-[44px] w-full resize-none bg-transparent text-xs leading-5 text-foreground outline-none transition-opacity duration-200 placeholder:text-[#777167] disabled:cursor-not-allowed disabled:opacity-50 dark:placeholder:text-[#8f8b82]"
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
        placeholder={
          mode === "ask"
            ? "Ask about the project or how a change would work."
            : "Describe what you want Inlaya to change."
        }
        value={instruction}
        required
      />

      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <div
            aria-label="Agent mode"
            className="flex h-7 items-center border border-[#171713]/15 bg-[#e8e2d5]/70 p-0.5 dark:border-[#fffaf0]/15 dark:bg-white/5"
            role="group"
          >
            {(["ask", "build"] as const).map((agentMode) => {
              const selected = mode === agentMode;
              const Icon = agentMode === "ask" ? ListTree : Hammer;

              return (
                <button
                  key={agentMode}
                  aria-pressed={selected}
                  className={cn(
                    "flex h-6 items-center gap-1 px-2 text-[10px] font-semibold capitalize text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#f04f2f]",
                    selected && "bg-[#fffaf0] text-[#171713] shadow-sm dark:bg-[#f3efe5]",
                  )}
                  disabled={accessBlocked || isPreparing}
                  onClick={() => onModeChange(agentMode)}
                  type="button"
                >
                  <Icon className="size-3" />
                  {agentMode}
                </button>
              );
            })}
          </div>

        </div>

        <Button
          aria-label={isPreparing ? "Agent is working" : "Run agent"}
          className="ml-auto h-7 w-7 rounded-none bg-[#171713] p-0 text-[#fffaf0] hover:bg-[#f04f2f] dark:bg-[#fffaf0] dark:text-[#171713] dark:hover:bg-[#f04f2f] dark:hover:text-white"
          disabled={accessBlocked || isPreparing || !instruction.trim()}
          onClick={onPrepareEdit}
          title={isPreparing ? "Agent is working" : "Run agent"}
          type="button"
        >
          {isPreparing ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowUp className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}
