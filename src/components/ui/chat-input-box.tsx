"use client";

import { useEffect, useRef } from "react";
import { ArrowUp, LoaderCircle } from "lucide-react";

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
        placeholder="Describe what you want Devin to change in the sandbox."
        value={instruction}
        required
      />

      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
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
