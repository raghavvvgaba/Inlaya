"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { AIChat, type AIChatMessage } from "~/components/ui/ai-chat";
import { ChatInputBox } from "~/components/ui/chat-input-box";

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
      messages: AIChatMessage[];
      pendingEdit: PendingEditSeed;
      status: "ok";
    }
  | {
      code: string;
      status: "error";
    };

function getClientErrorMessage(code: string): AIChatMessage {
  const fallbackError = {
    body: "The draft could not be prepared from this chat request.",
    tone: "error" as const,
  };
  const errorCopy: Record<string, Pick<AIChatMessage, "body" | "tone">> = {
    missing_file_path: {
      body: "Add the repository file path before preparing the edit.",
      tone: "error",
    },
    missing_instruction: {
      body: "Write the instruction you want Devin to follow for this issue.",
      tone: "error",
    },
    file_not_found: {
      body: "That file path does not exist in the repository. Try an exact path from GitHub.",
      tone: "error",
    },
    unsupported_file: {
      body: "This MVP can only prepare edits for text-based files right now.",
      tone: "error",
    },
    edit_access_missing: {
      body: "GitHub access is missing or expired for this repository, so the edit could not be prepared.",
      tone: "error",
    },
    issue_unavailable: {
      body: "The issue details could not be loaded from GitHub, so edit prep is paused for the moment.",
      tone: "error",
    },
    edit_ai_unavailable: {
      body: "The AI edit service is not configured right now, so no draft could be produced.",
      tone: "error",
    },
    edit_no_changes: {
      body: "The generated edit matched the current file. Tighten the instruction and try again.",
      tone: "warning",
    },
    edit_invalid_response: {
      body: "The generated edit came back in an unusable format. Try once more with a simpler request.",
      tone: "error",
    },
    edit_generation_failed: {
      body: "The model failed while preparing the edit. You can retry from this same chat thread.",
      tone: "error",
    },
    chat_persist_failed: {
      body: "The edit was prepared, but the chat could not be saved. Please retry so the thread stays durable.",
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
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [filePath, setFilePath] = useState(initialFilePath);
  const [instruction, setInstruction] = useState(initialInstruction);
  const [isPreparing, setIsPreparing] = useState(false);
  const [hasPendingEdit, setHasPendingEdit] = useState(Boolean(pendingEdit));

  const thinkingMessage = useMemo<AIChatMessage>(
    () => ({
      body: "Thinking",
      id: "thinking-message",
      isThinking: true,
      role: "assistant",
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
      body: `${trimmedInstruction}\n\nIssue #${issueNumber} · ${trimmedFilePath}`,
      id: `user-message-${Date.now()}`,
      role: "user",
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
        ...current.filter(
          (message) =>
            message.id !== thinkingMessage.id && message.id !== userMessage.id,
        ),
        ...result.messages,
      ]);
      router.refresh();
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
