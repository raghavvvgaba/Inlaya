"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { AIChat, type AIChatMessage } from "~/components/ui/ai-chat";
import { ChatInputBox } from "~/components/ui/chat-input-box";
import { buildIssueChatRuntimeMessage } from "~/lib/issue-chat-messages";

type IssueChatWorkspaceProps = {
  accessBlocked: boolean;
  agentAction: string;
  initialInstruction: string;
  initialMessages: AIChatMessage[];
  issueNumber: number;
  projectId: string;
};

type AgentResponse =
  | {
      clarificationQuestion?: string;
      message: string;
      messages?: AIChatMessage[];
      status: "blocked" | "completed" | "max_steps_reached";
    }
  | {
      message?: string;
      status: "failed";
    };

export function IssueChatWorkspace({
  accessBlocked,
  agentAction,
  initialInstruction,
  initialMessages,
  issueNumber,
  projectId,
}: IssueChatWorkspaceProps) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [instruction, setInstruction] = useState(initialInstruction);
  const [isRunning, setIsRunning] = useState(false);

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
    () => `devin:sandbox:${projectId}`,
    [projectId],
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

  function buildFallbackAgentMessage(result: Extract<AgentResponse, { status: "blocked" | "completed" | "max_steps_reached" }>): AIChatMessage {
    return {
      body: result.clarificationQuestion
        ? `${result.message}\n\nClarification needed: ${result.clarificationQuestion}`
        : result.message,
      id: `agent-message-${Date.now()}`,
      role: "assistant",
      tone:
        result.status === "completed"
          ? "success"
          : "warning",
    };
  }

  async function handleRunAgent() {
    const trimmedInstruction = instruction.trim();
    const sessionId = getSandboxSessionId();

    if (!trimmedInstruction || accessBlocked || isRunning) {
      return;
    }

    if (!sessionId) {
      setMessages((current) => [
        ...current,
        buildIssueChatRuntimeMessage("missing_session_id"),
      ]);
      return;
    }

    const userMessage: AIChatMessage = {
      body: `${trimmedInstruction}\n\nIssue #${issueNumber}`,
      id: `user-message-${Date.now()}`,
      role: "user",
    };

    setIsRunning(true);
    setMessages((current) => [...current, userMessage, thinkingMessage]);

    try {
      const response = await fetch(agentAction, {
        body: JSON.stringify({
          instruction: trimmedInstruction,
          sessionId,
        }),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const result = (await response.json()) as AgentResponse;

      if (!response.ok || result.status === "failed") {
        setMessages((current) => [
          ...current.filter((message) => message.id !== thinkingMessage.id),
          buildIssueChatRuntimeMessage("agent_run_failed", {
            fallbackBody:
              result.message ?? "The sandbox agent could not finish this request.",
          }),
        ]);
        return;
      }

      setInstruction("");
      const nextMessages =
        result.messages && result.messages.length > 0
          ? result.messages
          : [userMessage, buildFallbackAgentMessage(result)];

      setMessages((current) => [
        ...current.filter(
          (message) =>
            message.id !== thinkingMessage.id && message.id !== userMessage.id,
        ),
        ...nextMessages,
      ]);
      router.refresh();
    } catch {
      setMessages((current) => [
        ...current.filter((message) => message.id !== thinkingMessage.id),
        buildIssueChatRuntimeMessage("agent_run_failed"),
      ]);
    } finally {
      setIsRunning(false);
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
        instruction={instruction}
        isPreparing={isRunning}
        onInstructionChange={setInstruction}
        onPrepareEdit={handleRunAgent}
      />
    </AIChat>
  );
}
