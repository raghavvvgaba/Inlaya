"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, GitPullRequest, LoaderCircle, PanelLeftClose } from "lucide-react";
import { toast } from "sonner";

import { AIChat, type AIChatMessage } from "~/components/ui/ai-chat";
import { Button } from "~/components/ui/button";
import { ChatInputBox } from "~/components/ui/chat-input-box";
import { useSidebar } from "~/components/issue-workspace-layout";
import { buildIssueChatRuntimeMessage } from "~/lib/issue-chat-messages";
import { sandboxSessionUpdatedEvent } from "~/lib/sandbox-events";

type IssueChatWorkspaceProps = {
  accessBlocked: boolean;
  agentAction: string;
  initialInstruction: string;
  initialMessages: AIChatMessage[];
  issueNumber: number;
  issueTitle?: string;
  projectId: string;
  sessionAction: string;
  submitAction: string;
};

type AgentResponse =
  | {
      clarificationQuestion?: string;
      message: string;
      messages?: AIChatMessage[];
      status: "blocked" | "completed";
    }
  | {
      message?: string;
      status: "failed";
    };

type SubmitResponse =
  | {
      branchName?: string;
      message: string;
      messages?: AIChatMessage[];
      pullRequestNumber?: number;
      pullRequestUrl?: string;
      status: "completed" | "noop" | "reused";
    }
  | {
      message: string;
      status: "failed";
    };

type SandboxSessionResponse =
  | {
      ok: true;
      session: {
        submitMessage?: string;
        submitStage?: string;
        submitState?: string;
      };
    }
  | {
      error: string;
      ok: false;
    };

export function IssueChatWorkspace({
  accessBlocked,
  agentAction,
  initialInstruction,
  initialMessages,
  issueNumber,
  issueTitle,
  projectId,
  sessionAction,
  submitAction,
}: IssueChatWorkspaceProps) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [instruction, setInstruction] = useState(initialInstruction);
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pullRequestUrl, setPullRequestUrl] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitSessionId, setSubmitSessionId] = useState<string | null>(null);
  const { setIsOpen } = useSidebar();

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

  function buildFallbackAgentMessage(
    result: Extract<AgentResponse, { status: "blocked" | "completed" }>,
  ): AIChatMessage {
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

  async function refreshSubmitProgress(sessionId: string) {
    const url = new URL(sessionAction, window.location.origin);
    url.searchParams.set("sessionId", sessionId);
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });
    const result = (await response.json()) as SandboxSessionResponse;

    if (response.ok && result.ok) {
      setSubmitMessage(result.session.submitMessage ?? null);
    }
  }

  useEffect(() => {
    if (!isSubmitting || !submitSessionId) {
      return;
    }

    void refreshSubmitProgress(submitSessionId);

    const interval = window.setInterval(() => {
      void refreshSubmitProgress(submitSessionId);
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [isSubmitting, submitSessionId]);

  async function handleRunAgent() {
    const trimmedInstruction = instruction.trim();
    const sessionId = getSandboxSessionId();

    if (!trimmedInstruction || accessBlocked || isRunning) {
      return;
    }

    if (!sessionId) {
      toast.error("Start the sandbox first so Devin has a live workspace to edit.");
      return;
    }

    const userMessage: AIChatMessage = {
      body: trimmedInstruction,
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
      window.dispatchEvent(
        new CustomEvent(sandboxSessionUpdatedEvent, {
          detail: { projectId, sessionId },
        }),
      );
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

  async function handleSubmitChanges() {
    const sessionId = getSandboxSessionId();

    if (accessBlocked || isRunning || isSubmitting) {
      return;
    }

    if (!sessionId) {
      toast.error("Start the sandbox first so Devin has a live workspace to edit.");
      return;
    }

    setIsSubmitting(true);
    setPullRequestUrl(null);
    setSubmitMessage("Preparing submit");
    setSubmitSessionId(sessionId);

    try {
      const response = await fetch(submitAction, {
        body: JSON.stringify({ sessionId }),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = (await response.json()) as SubmitResponse;

      if (!response.ok || result.status === "failed") {
        setMessages((current) => [
          ...current,
          buildIssueChatRuntimeMessage("submit_failed", {
            fallbackBody: result.message,
          }),
        ]);
        toast.error(result.message);
        return;
      }

      if (result.messages?.length) {
        setMessages((current) => [...current, ...result.messages!]);
      }

      setSubmitMessage(result.message);

      if (result.pullRequestUrl) {
        setPullRequestUrl(result.pullRequestUrl);
      }

      if (result.status === "noop") {
        toast.warning(result.message);
      } else {
        toast.success(result.message);
      }

      router.refresh();
    } catch {
      const fallbackMessage = "The pull request could not be created.";
      setMessages((current) => [
        ...current,
        buildIssueChatRuntimeMessage("submit_failed", {
          fallbackBody: fallbackMessage,
        }),
      ]);
      toast.error(fallbackMessage);
    } finally {
      setIsSubmitting(false);
      setSubmitSessionId(null);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {issueTitle ? (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 rounded-none text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => setIsOpen(false)}
            >
              <PanelLeftClose className="h-3.5 w-3.5" />
            </Button>
            <h1 className="min-w-0 flex-1 text-sm font-bold uppercase tracking-tight line-clamp-2">
              {issueTitle}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {pullRequestUrl ? (
              <Button
                asChild
                className="h-6 rounded-none border-border bg-transparent px-2 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
                variant="outline"
              >
                <a href={pullRequestUrl} rel="noreferrer" target="_blank">
                  <ExternalLink className="mr-1 h-3 w-3" />
                  Open PR
                </a>
              </Button>
            ) : null}
            <Button
              className="h-6 rounded-none px-2 text-[10px] font-medium"
              disabled={accessBlocked || isRunning || isSubmitting}
              onClick={handleSubmitChanges}
              type="button"
            >
              {isSubmitting ? (
                <LoaderCircle className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <GitPullRequest className="mr-1 h-3 w-3" />
              )}
              {isSubmitting ? "Submitting" : "Submit"}
            </Button>
          </div>
        </div>
      ) : null}

      <AIChat
        className="flex min-h-0 flex-1 flex-col border-x-0 border-b-0"
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
    </div>
  );
}
