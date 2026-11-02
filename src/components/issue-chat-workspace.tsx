"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  CheckCircle2,
  ChevronLeft,
  ExternalLink,
  GitPullRequest,
  LoaderCircle,
  MoreHorizontal,
  PanelLeftClose,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { AIChat, type AIChatMessage } from "~/components/ui/ai-chat";
import { Button } from "~/components/ui/button";
import { ChatInputBox } from "~/components/ui/chat-input-box";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useSidebar } from "~/components/issue-workspace-layout";
import {
  appendFinalMessageDelta,
  removeTransientAgentMessages,
  workingMessageId,
} from "~/lib/agent-stream-state";
import { DEFAULT_AGENT_MODEL, isAgentModelId } from "~/lib/agent-models";
import { buildIssueChatRuntimeMessage } from "~/lib/issue-chat-messages";
import { sandboxSessionUpdatedEvent } from "~/lib/sandbox-events";
import { parseSseFrames } from "~/lib/sse";
import type { SandboxAgentMode } from "~/server/sandbox/types";

type IssueChatWorkspaceProps = {
  accessBlocked: boolean;
  agentAction: string;
  backHref: string;
  clearChatAction: string;
  initialInstruction: string;
  initialMessages: AIChatMessage[];
  issueDetails?: ReactNode;
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

type AgentStreamEvent =
  | {
      message: string;
      type: "progress";
    }
  | {
      delta: string;
      type: "final_delta";
    }
  | {
      result: AgentResponse;
      type: "final";
    }
  | {
      message: string;
      type: "error";
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

const MAX_WORKING_UPDATES = 5;

export function IssueChatWorkspace({
  accessBlocked,
  agentAction,
  backHref,
  clearChatAction,
  initialInstruction,
  initialMessages,
  issueDetails,
  issueNumber,
  issueTitle,
  projectId,
  sessionAction,
  submitAction,
}: IssueChatWorkspaceProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [instruction, setInstruction] = useState(initialInstruction);
  const [agentMode, setAgentMode] = useState<SandboxAgentMode>("build");
  const [isRunning, setIsRunning] = useState(false);
  const [isClearingChat, setIsClearingChat] = useState(false);
  const [isClearChatDialogOpen, setIsClearChatDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Only tracks build runs from this page visit; the header menu still
  // allows submitting changes made before a reload.
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [pullRequestUrl, setPullRequestUrl] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitSessionId, setSubmitSessionId] = useState<string | null>(null);
  const { setIsOpen } = useSidebar();

  const storageKey = useMemo(
    () => `devin:sandbox:${projectId}`,
    [projectId],
  );
  const modelStorageKey = useMemo(
    () => `devin:sandbox:${projectId}:model`,
    [projectId],
  );
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    try {
      const saved = window.localStorage.getItem(modelStorageKey);
      return isAgentModelId(saved) ? saved : DEFAULT_AGENT_MODEL;
    } catch {
      return DEFAULT_AGENT_MODEL;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(modelStorageKey, selectedModel);
    } catch {}
  }, [modelStorageKey, selectedModel]);
  const hasVisibleMessages = messages.some((message) => !message.isThinking);
  const canClearChat =
    !accessBlocked &&
    !isClearingChat &&
    !isRunning &&
    !isSubmitting &&
    hasVisibleMessages;

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

  function buildWorkingMessage(updates: string[]): AIChatMessage {
    return {
      body: updates.join("\n"),
      id: workingMessageId,
      isThinking: true,
      role: "assistant",
      tone: "default",
    };
  }

  function pushWorkingUpdate(message: string) {
    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      return;
    }

    setMessages((current) => {
      const existing = current.find((item) => item.id === workingMessageId);
      const existingUpdates = existing?.body
        ? existing.body.split("\n").filter(Boolean)
        : [];
      const nextUpdates = [...existingUpdates, trimmedMessage].slice(
        -MAX_WORKING_UPDATES,
      );
      const nextWorkingMessage = buildWorkingMessage(nextUpdates);

      if (!existing) {
        return [...current, nextWorkingMessage];
      }

      return current.map((item) =>
        item.id === workingMessageId ? nextWorkingMessage : item,
      );
    });
  }

  async function readAgentStream(response: Response): Promise<AgentResponse> {
    if (!response.body) {
      throw new Error("The sandbox agent did not return a stream.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const parsed = parseSseFrames(buffer);
      buffer = parsed.remaining;

      for (const event of parsed.events) {
        const parsedEvent = JSON.parse(event.data) as AgentStreamEvent;

        switch (parsedEvent.type) {
          case "progress":
            pushWorkingUpdate(parsedEvent.message);
            break;
          case "final_delta":
            setMessages((current) =>
              appendFinalMessageDelta(current, parsedEvent.delta),
            );
            break;
          case "final":
            return parsedEvent.result;
          case "error":
            return {
              message: parsedEvent.message,
              status: "failed",
            };
        }
      }
    }

    throw new Error("The sandbox agent stream ended before a final response.");
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
    const runMode = agentMode;

    if (!trimmedInstruction || accessBlocked || isRunning) {
      return;
    }

    if (!sessionId) {
      toast.error("Start the sandbox first so Inlaya has a live workspace to edit.");
      return;
    }

    const userMessage: AIChatMessage = {
      body: trimmedInstruction,
      id: `user-message-${Date.now()}`,
      role: "user",
    };

    setInstruction("");
    setIsRunning(true);
    setMessages((current) => [
      ...current,
      userMessage,
      buildWorkingMessage(["Starting workspace run..."]),
    ]);

    try {
      const response = await fetch(agentAction, {
        body: JSON.stringify({
          instruction: trimmedInstruction,
          mode: agentMode,
          model: selectedModel,
          sessionId,
        }),
        headers: {
          Accept: "text/event-stream, application/json",
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const contentType = response.headers.get("Content-Type") ?? "";
      const result = contentType.includes("text/event-stream")
        ? await readAgentStream(response)
        : ((await response.json()) as AgentResponse);

      if (!response.ok || result.status === "failed") {
        setMessages((current) => [
          ...removeTransientAgentMessages(current),
          buildIssueChatRuntimeMessage("agent_run_failed", {
            fallbackBody:
              result.message ?? "The sandbox agent could not finish this request.",
          }),
        ]);
        return;
      }

      const nextMessages =
        result.messages && result.messages.length > 0
          ? result.messages
          : [userMessage, buildFallbackAgentMessage(result)];

      setMessages((current) => [
        ...removeTransientAgentMessages(current).filter(
          (message) => message.id !== userMessage.id,
        ),
        ...nextMessages,
      ]);
      if (runMode === "build" && result.status === "completed") {
        setHasPendingChanges(true);
      }
      window.dispatchEvent(
        new CustomEvent(sandboxSessionUpdatedEvent, {
          detail: { projectId, sessionId },
        }),
      );
    } catch {
      setMessages((current) => [
        ...removeTransientAgentMessages(current),
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
      toast.error("Start the sandbox first so Inlaya has a live workspace to edit.");
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
      setHasPendingChanges(false);

      if (result.pullRequestUrl) {
        setPullRequestUrl(result.pullRequestUrl);
      }

      if (result.status === "noop") {
        toast.warning(result.message);
      } else {
        toast.success(result.message);
      }
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

  async function handleClearChat() {
    if (!canClearChat) {
      return;
    }

    setIsClearingChat(true);

    try {
      const response = await fetch(clearChatAction, {
        headers: {
          Accept: "application/json",
        },
        method: "DELETE",
      });

      if (!response.ok) {
        toast.error("Chat history could not be cleared.");
        return;
      }

      setMessages([]);
      setIsClearChatDialogOpen(false);
      toast.success("Chat history cleared.");
    } catch {
      toast.error("Chat history could not be cleared.");
    } finally {
      setIsClearingChat(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="relative flex min-h-14 shrink-0 items-center gap-2 border-b border-[#171713]/15 bg-[#f3efe5]/70 px-3 py-2 dark:border-[#fffaf0]/15 dark:bg-[#11110f]/70">
        <span className="absolute bottom-[-1px] left-3 h-px w-12 bg-[#f04f2f]" />
        <Button
          asChild
          className="h-7 w-7 shrink-0 rounded-none text-[#6d675d] hover:bg-[#171713]/5 hover:text-[#171713] dark:text-[#aaa69d] dark:hover:bg-white/5 dark:hover:text-[#fffaf0]"
          size="icon"
          variant="ghost"
        >
          <Link aria-label="Back to project" href={backHref}>
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="inlaya-display min-w-0 flex-1 text-base font-medium leading-tight tracking-[-0.025em] line-clamp-2">
          {issueTitle ?? `Issue #${issueNumber}`}
        </h1>
        <div className="flex shrink-0 items-center gap-1">
          {issueDetails}
          <Button
            className="h-7 rounded-none bg-[#171713] px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#fffaf0] hover:bg-[#f04f2f] dark:bg-[#fffaf0] dark:text-[#171713] dark:hover:bg-[#f04f2f] dark:hover:text-white"
            disabled={accessBlocked || isRunning || isSubmitting}
            onClick={() => void handleSubmitChanges()}
            title="Submit your changes for review"
            type="button"
          >
            {isSubmitting ? (
              <LoaderCircle className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <GitPullRequest className="mr-1 h-3 w-3" />
            )}
            {isSubmitting ? "Submitting" : "Submit"}
          </Button>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="More options"
                className="h-7 w-7 rounded-none text-[#6d675d] hover:bg-[#171713]/5 hover:text-[#171713] dark:text-[#aaa69d] dark:hover:bg-white/5 dark:hover:text-[#fffaf0]"
                size="icon"
                type="button"
                variant="ghost"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem asChild>
                <Link href="/activity">
                  <Activity className="h-3.5 w-3.5" />
                  Activity
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!canClearChat}
                onClick={() => setIsClearChatDialogOpen(true)}
                variant="destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            aria-label="Hide chat"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 rounded-none text-[#6d675d] hover:bg-[#f04f2f] hover:text-white dark:text-[#aaa69d]"
            onClick={() => setIsOpen(false)}
          >
            <PanelLeftClose className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      <Dialog
        open={isClearChatDialogOpen}
        onOpenChange={setIsClearChatDialogOpen}
      >
        <DialogContent
          className="inlaya-landing rounded-none border-[#171713]/25 bg-[#f3efe5] text-[#171713] shadow-[10px_10px_0_rgba(240,79,47,0.2)] dark:border-[#fffaf0]/20 dark:bg-[#11110f] dark:text-[#f3efe5]"
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle>Clear issue chat?</DialogTitle>
            <DialogDescription>
              This removes the saved chat history for issue #{issueNumber}.
              It will not affect the sandbox, preview, or pull request state.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button
                className="rounded-none"
                disabled={isClearingChat}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              className="rounded-none"
              disabled={isClearingChat}
              onClick={handleClearChat}
              type="button"
              variant="destructive"
            >
              {isClearingChat ? (
                <LoaderCircle className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="mr-1 h-3 w-3" />
              )}
              Clear chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AIChat
        className="flex min-h-0 flex-1 flex-col border-x-0 border-b-0 border-t-0"
        fullBleed
        messages={messages}
      >
      <SubmitReviewCard
        accessBlocked={accessBlocked}
        hasPendingChanges={hasPendingChanges}
        isRunning={isRunning}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmitChanges}
        pullRequestUrl={pullRequestUrl}
        submitMessage={submitMessage}
      />
      <ChatInputBox
        accessBlocked={accessBlocked}
        instruction={instruction}
        isPreparing={isRunning}
        mode={agentMode}
        onInstructionChange={setInstruction}
        onModeChange={setAgentMode}
        onModelChange={setSelectedModel}
        onPrepareEdit={handleRunAgent}
        selectedModel={selectedModel}
      />
      </AIChat>
    </div>
  );
}

function SubmitReviewCard({
  accessBlocked,
  hasPendingChanges,
  isRunning,
  isSubmitting,
  onSubmit,
  pullRequestUrl,
  submitMessage,
}: {
  accessBlocked: boolean;
  hasPendingChanges: boolean;
  isRunning: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
  pullRequestUrl: string | null;
  submitMessage: string | null;
}) {
  if (isRunning || (!isSubmitting && !hasPendingChanges && !pullRequestUrl)) {
    return null;
  }

  let icon: ReactNode;
  let title: string;
  let body: string;
  let action: ReactNode = null;

  if (isSubmitting) {
    icon = <LoaderCircle className="h-4 w-4 animate-spin text-[#f04f2f]" />;
    title = "Submitting for review";
    body = submitMessage ?? "Preparing your changes";
  } else if (hasPendingChanges) {
    icon = <GitPullRequest className="h-4 w-4 text-[#f04f2f]" />;
    title = pullRequestUrl ? "New changes ready" : "Your changes are ready";
    body = pullRequestUrl
      ? "Submit again to add them to the open pull request."
      : "Check the preview, then submit them for review.";
    action = (
      <Button
        className="h-8 shrink-0 rounded-none bg-[#171713] px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#fffaf0] hover:bg-[#f04f2f] dark:bg-[#fffaf0] dark:text-[#171713] dark:hover:bg-[#f04f2f] dark:hover:text-white"
        disabled={accessBlocked}
        onClick={onSubmit}
        type="button"
      >
        Submit for review
      </Button>
    );
  } else {
    icon = <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />;
    title = "Submitted for review";
    body = "A pull request is open with your changes.";
    action = (
      <Button
        asChild
        className="h-8 shrink-0 rounded-none border-[#171713]/20 bg-transparent px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6d675d] hover:border-[#f04f2f] hover:bg-[#f04f2f]/10 hover:text-[#171713] dark:border-[#fffaf0]/20 dark:text-[#aaa69d] dark:hover:text-[#fffaf0]"
        variant="outline"
      >
        <a href={pullRequestUrl ?? undefined} rel="noreferrer" target="_blank">
          <ExternalLink className="mr-1 h-3 w-3" />
          View PR
        </a>
      </Button>
    );
  }

  return (
    <div className="mx-3 mb-2 flex items-center gap-3 border border-[#171713]/15 bg-[#fffaf0]/80 px-3 py-2.5 dark:border-white/10 dark:bg-[#171713]/80">
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-[#171713] dark:text-[#fffaf0]">{title}</p>
        <p className="truncate text-[11px] text-[#777167] dark:text-[#817e75]">{body}</p>
      </div>
      {action}
    </div>
  );
}
