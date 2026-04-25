"use client";

import { useState } from "react";
import { GitBranch, LoaderCircle, PencilLine } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

type IssueEditFormProps = {
  action: string;
  defaultFilePath: string;
  defaultInstruction: string;
  disabled?: boolean;
  issueNumber: number;
  pendingEditExists: boolean;
};

export function IssueEditForm({
  action,
  defaultFilePath,
  defaultInstruction,
  disabled = false,
  issueNumber,
  pendingEditExists,
}: IssueEditFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <form
      action={action}
      className="space-y-4"
      method="post"
      onSubmit={() => {
        setIsSubmitting(true);
      }}
    >
      <div className="space-y-2">
        <label
          className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground"
          htmlFor="filePath"
        >
          Target file path
        </label>
        <Input
          className="rounded-none h-12 font-mono text-xs uppercase"
          defaultValue={defaultFilePath}
          disabled={disabled}
          id="filePath"
          name="filePath"
          placeholder="README.md"
          required
        />
      </div>
      <div className="space-y-2">
        <label
          className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground"
          htmlFor="instruction"
        >
          Edit instruction
        </label>
        <textarea
          className="flex min-h-32 w-full rounded-none border border-input bg-background px-3 py-3 font-mono text-xs leading-relaxed shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
          defaultValue={defaultInstruction}
          disabled={disabled}
          id="instruction"
          name="instruction"
          placeholder="Describe the exact change you want in this file."
          required
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="space-y-2">
          <Button
            className="rounded-none font-bold uppercase text-[10px] tracking-widest h-11 px-5"
            disabled={disabled || isSubmitting}
            type="submit"
          >
            {isSubmitting ? (
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PencilLine className="mr-2 h-4 w-4" />
            )}
            {isSubmitting ? "Generating..." : "Generate AI Edit"}
          </Button>
          {isSubmitting ? (
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Contacting GitHub and OpenRouter to prepare the file edit...
            </p>
          ) : null}
        </div>
        {pendingEditExists ? (
          <Button
            className="rounded-none font-bold uppercase text-[10px] tracking-widest h-11 px-5"
            disabled={isSubmitting}
            form="commit-form"
            type="submit"
          >
            <GitBranch className="mr-2 h-4 w-4" />
            Create Branch + Commit
          </Button>
        ) : null}
      </div>
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        Phase 2A uses a single-file AI editor. Review the generated file before
        creating the branch and commit for issue #{issueNumber}.
      </p>
    </form>
  );
}
