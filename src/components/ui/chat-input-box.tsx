"use client";

import { useEffect, useRef } from "react";
import { ArrowUp, Hammer, ListTree, LoaderCircle } from "lucide-react";

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
    <div className="flex w-full flex-col">
      <textarea
        ref={textareaRef}
        className="min-h-[40px] w-full resize-none bg-transparent text-xs leading-5 text-foreground outline-none transition-opacity duration-200 placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
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
          mode === "plan"
            ? "Ask about the project or plan a change."
            : "Describe what you want Devin to change."
        }
        value={instruction}
        required
      />

      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div
          aria-label="Agent mode"
          className="flex h-6 items-center border border-border bg-muted/40 p-0.5"
          role="group"
        >
          {(["plan", "build"] as const).map((agentMode) => {
            const selected = mode === agentMode;
            const Icon = agentMode === "plan" ? ListTree : Hammer;

            return (
              <button
                key={agentMode}
                aria-pressed={selected}
                className={cn(
                  "flex h-5 items-center gap-1 px-2 text-[10px] font-medium capitalize text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  selected && "bg-background text-foreground shadow-sm",
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

        <Button
          className="ml-auto h-6 rounded-none px-2 text-[10px] font-medium"
          disabled={accessBlocked || isPreparing || !instruction.trim()}
          onClick={onPrepareEdit}
          type="button"
        >
          {isPreparing ? (
            <LoaderCircle className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <ArrowUp className="mr-1 h-3 w-3" />
          )}
          {isPreparing ? "Working" : "Run Agent"}
        </Button>
      </div>
    </div>
  );
}
