"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { AIChat, type AIChatMessage } from "~/components/ui/ai-chat";
import { ChatInputBox } from "~/components/ui/chat-input-box";

type IssueChatWorkspaceProps = {
  accessBlocked: boolean;
  editAction: string;
  initialFilePath: string;
  initialInstruction: string;
  initialMessages: AIChatMessage[];
  issueNumber: number;
  projectId: string;
};

type EditResponse =
  | {
      filePath: string;
      messages: AIChatMessage[];
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
      body: "That file path does not exist in the sandboxed repository. Try an exact repo-relative path.",
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
    invalid_path: {
      body: "Use a repo-relative file path inside the sandboxed repository.",
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
    edit_provider_rejected_request: {
      body: "The AI provider rejected this edit request. The server log now includes the OpenRouter response details so we can see which parameter or model constraint caused it.",
      tone: "error",
    },
    edit_rate_limited: {
      body: "OpenRouter rate limited this edit request. Give it a moment and retry from the same chat thread.",
      tone: "warning",
    },
    edit_generation_failed: {
      body: "The model failed while preparing the edit. You can retry from this same chat thread.",
      tone: "error",
    },
    missing_session_id: {
      body: "Start the sandbox first so Devin has a live workspace to edit.",
      tone: "error",
    },
    sandbox_not_running: {
      body: "The sandbox is not running right now. Start it again, then retry the edit.",
      tone: "error",
    },
    session_not_found: {
      body: "This sandbox session is no longer available. Start a fresh sandbox and retry the edit.",
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
  editAction,
  initialFilePath,
  initialInstruction,
  initialMessages,
  issueNumber,
  projectId,
}: IssueChatWorkspaceProps) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [filePath, setFilePath] = useState(initialFilePath);
  const [instruction, setInstruction] = useState(initialInstruction);
  const [isPreparing, setIsPreparing] = useState(false);

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

  const storageKey = useMemo(
    () => `devin:sandbox:${projectId}:${issueNumber}`,
    [issueNumber, projectId],
  );

  function getSandboxSessionId() {
    try {
      const savedValue = window.localStorage.getItem(storageKey);

      if (!savedValue) {
        return null;
      }

      const saved = JSON.parse(savedValue) as { sessionId?: unknown };
      return typeof saved.sessionId === "string" && saved.sessionId.trim()
        ? saved.sessionId.trim()
        : null;
    } catch {
      return null;
    }
  }

  async function handlePrepareEdit() {
    const trimmedFilePath = filePath.trim();
    const trimmedInstruction = instruction.trim();
    const sessionId = getSandboxSessionId();

    if (!trimmedFilePath || !trimmedInstruction || accessBlocked || isPreparing) {
      return;
    }

    if (!sessionId) {
      setMessages((current) => [
        ...current,
        getClientErrorMessage("missing_session_id"),
      ]);
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
          sessionId,
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

      setFilePath(result.filePath);
      setInstruction(trimmedInstruction);
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
      className="h-auto min-h-[32rem]"
      fullBleed
      messages={messages}
    >
      <ChatInputBox
        accessBlocked={accessBlocked}
        filePath={filePath}
        instruction={instruction}
        isPreparing={isPreparing}
        onFilePathChange={setFilePath}
        onInstructionChange={setInstruction}
        onPrepareEdit={handlePrepareEdit}
      />
    </AIChat>
  );
}
