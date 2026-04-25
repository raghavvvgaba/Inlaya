"use client";

import { useMemo, useState } from "react";

import { AIChat, type AIChatMessage } from "~/components/ui/ai-chat";
import { ChatInputBox } from "~/components/ui/chat-input-box";
import { buildIssueChatDiffPreview } from "~/lib/issue-chat-diff";

type PendingEditSeed = {
  filePath: string;
  model: string;
  originalContent: string;
  summary: string;
  updatedContent: string;
  userInstruction: string;
};

type IssueChatWorkspaceProps = {
  accessBlocked: boolean;
  cancelAction: string;
  commitAction: string;
  editAction: string;
  initialFilePath: string;
  initialInstruction: string;
  initialMessages: AIChatMessage[];
  issueNumber: number;
  pendingEdit: PendingEditSeed | null;
  postCommitExists: boolean;
  pullRequestAction: string;
  pullRequestExists: boolean;
  pullRequestUrl?: string;
};

type EditResponse =
  | {
      pendingEdit: PendingEditSeed;
      status: "ok";
    }
  | {
      code: string;
      status: "error";
    };

function getClientErrorMessage(code: string): AIChatMessage {
  const fallbackError = {
    title: "Edit preparation failed",
    body: "The draft could not be prepared from this chat request.",
    tone: "error" as const,
  };
  const errorCopy: Record<string, Pick<AIChatMessage, "body" | "title" | "tone">> = {
    missing_file_path: {
      title: "File path missing",
      body: "Add the repository file path before preparing the edit.",
      tone: "error",
    },
    missing_instruction: {
      title: "Instruction missing",
      body: "Write the instruction you want Devin to follow for this issue.",
      tone: "error",
    },
    file_not_found: {
      title: "File not found",
      body: "That file path does not exist in the repository. Try an exact path from GitHub.",
      tone: "error",
    },
    unsupported_file: {
      title: "Unsupported file",
      body: "This MVP can only prepare edits for text-based files right now.",
      tone: "error",
    },
    edit_access_missing: {
      title: "Repository access missing",
      body: "GitHub access is missing or expired for this repository, so the edit could not be prepared.",
      tone: "error",
    },
    issue_unavailable: {
      title: "Issue unavailable",
      body: "The issue details could not be loaded from GitHub, so edit prep is paused for the moment.",
      tone: "error",
    },
    edit_ai_unavailable: {
      title: "Edit model unavailable",
      body: "The AI edit service is not configured right now, so no draft could be produced.",
      tone: "error",
    },
    edit_no_changes: {
      title: "No changes generated",
      body: "The generated edit matched the current file. Tighten the instruction and try again.",
      tone: "warning",
    },
    edit_invalid_response: {
      title: "Invalid edit response",
      body: "The generated edit came back in an unusable format. Try once more with a simpler request.",
      tone: "error",
    },
    edit_generation_failed: {
      title: "Edit generation failed",
      body: "The model failed while preparing the edit. You can retry from this same chat thread.",
      tone: "error",
    },
    edit_prepare_failed: {
      ...fallbackError,
    },
  };

  return {
    id: `error-${Date.now()}`,
    role: "system",
    ...(errorCopy[code] ?? fallbackError),
  };
}

export function IssueChatWorkspace({
  accessBlocked,
  cancelAction,
  commitAction,
  editAction,
  initialFilePath,
  initialInstruction,
  initialMessages,
  issueNumber,
  pendingEdit,
  postCommitExists,
  pullRequestAction,
  pullRequestExists,
  pullRequestUrl,
}: IssueChatWorkspaceProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [filePath, setFilePath] = useState(initialFilePath);
  const [instruction, setInstruction] = useState(initialInstruction);
  const [isPreparing, setIsPreparing] = useState(false);
  const [hasPendingEdit, setHasPendingEdit] = useState(Boolean(pendingEdit));

  const thinkingMessage = useMemo<AIChatMessage>(
    () => ({
      body: "Thinking",
      id: "thinking-message",
      kind: "thinking",
      role: "assistant",
      title: "Preparing edit",
      tone: "default",
    }),
    [],
  );

  async function handlePrepareEdit() {
    const trimmedFilePath = filePath.trim();
    const trimmedInstruction = instruction.trim();

    if (!trimmedFilePath || !trimmedInstruction || accessBlocked || isPreparing) {
      return;
    }

    const userMessage: AIChatMessage = {
      body: trimmedInstruction,
      id: `user-message-${Date.now()}`,
      meta: `Issue #${issueNumber} • ${trimmedFilePath}`,
      role: "user",
      title: "You",
    };

    setIsPreparing(true);
    setMessages((current) => [...current, userMessage, thinkingMessage]);

    try {
      const response = await fetch(editAction, {
        body: JSON.stringify({
          filePath: trimmedFilePath,
          instruction: trimmedInstruction,
        }),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const result = (await response.json()) as EditResponse;

      if (!response.ok || result.status !== "ok") {
        setMessages((current) => [
          ...current.filter((message) => message.id !== thinkingMessage.id),
          getClientErrorMessage(
            result.status === "error" ? result.code : "edit_prepare_failed",
          ),
        ]);
        return;
      }

      setHasPendingEdit(true);
      setFilePath(result.pendingEdit.filePath);
      setInstruction(result.pendingEdit.userInstruction);
      setMessages((current) => [
        ...current.filter((message) => message.id !== thinkingMessage.id),
        {
          body: result.pendingEdit.summary,
          diff: buildIssueChatDiffPreview(
            result.pendingEdit.filePath,
            result.pendingEdit.summary,
            result.pendingEdit.originalContent,
            result.pendingEdit.updatedContent,
          ),
          id: `assistant-diff-${Date.now()}`,
          kind: "diff",
          meta: `Prepared with ${result.pendingEdit.model}`,
          role: "assistant",
          title: `Prepared edit for ${result.pendingEdit.filePath}`,
          tone: "success",
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current.filter((message) => message.id !== thinkingMessage.id),
        getClientErrorMessage("edit_prepare_failed"),
      ]);
    } finally {
      setIsPreparing(false);
    }
  }

  return (
    <AIChat
      className="flex-1"
      fullBleed
      messages={messages}
    >
      <ChatInputBox
        accessBlocked={accessBlocked}
        cancelAction={cancelAction}
        commitAction={commitAction}
        filePath={filePath}
        hasPendingEdit={hasPendingEdit}
        instruction={instruction}
        isPreparing={isPreparing}
        onFilePathChange={setFilePath}
        onInstructionChange={setInstruction}
        onPrepareEdit={handlePrepareEdit}
        postCommitExists={postCommitExists}
        pullRequestAction={pullRequestAction}
        pullRequestExists={pullRequestExists}
        pullRequestUrl={pullRequestUrl}
      />
    </AIChat>
  );
}
