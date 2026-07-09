import { NextResponse } from "next/server";

import {
  appendIssueChatMessages,
  getOrCreateIssueChatSession,
} from "~/server/chat";
import { revalidateProjectGitHubReads } from "~/server/github/cache";
import { fetchProjectIssue } from "~/server/github/issues";
import { runSandboxAgent } from "~/server/sandbox/agent";
import { formatSseEvent } from "~/server/sandbox/agent-stream";
import {
  getOwnedIssueProject,
  readJsonObject,
  readStringField,
  verifyIssueSandboxAccess,
  type IssueSandboxRouteContext,
} from "~/server/sandbox/route-helpers";

export const runtime = "nodejs";
export const maxDuration = 120;

function jsonFailure(message: string, status: number) {
  return NextResponse.json(
    {
      message,
      status: "failed" as const,
    },
    { status },
  );
}

function mapOwnershipFailure(status: number) {
  if (status === 401) {
    return jsonFailure("Sign in to continue using the sandbox agent.", 401);
  }

  return jsonFailure("This project could not be found.", 404);
}

function mapIssueFailure(status: Awaited<ReturnType<typeof fetchProjectIssue>>["status"]) {
  switch (status) {
    case "missing_access":
      return jsonFailure(
        "GitHub access for this repository is missing or expired.",
        403,
      );
    case "not_found":
      return jsonFailure("This issue could not be found.", 404);
    default:
      return jsonFailure("The issue details could not be loaded right now.", 400);
  }
}

function buildAgentSummary(result: Awaited<ReturnType<typeof runSandboxAgent>>) {
  const clarification = result.clarificationQuestion
    ? `\n\nClarification needed: ${result.clarificationQuestion}`
    : "";

  switch (result.status) {
    case "completed":
      return {
        body: result.message,
        tone: "success" as const,
      };
    case "blocked":
      return {
        body: `${result.message}${clarification}`,
        tone: result.failureCode ? ("error" as const) : ("warning" as const),
      };
    default:
      return {
        body: result.message,
        tone: "error" as const,
      };
  }
}

function createAgentStream() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController;
    },
  });

  function send(event: Parameters<typeof formatSseEvent>[0]) {
    controller?.enqueue(encoder.encode(formatSseEvent(event)));
  }

  function close() {
    controller?.close();
  }

  return {
    close,
    send,
    stream,
  };
}

async function persistAgentChatMessages(input: {
  issueNumber: number;
  issueTitle: string;
  projectId: string;
  result: Awaited<ReturnType<typeof runSandboxAgent>>;
  userId: string;
  userInstruction: string;
}) {
  const chatSession = await getOrCreateIssueChatSession({
    issueNumber: input.issueNumber,
    projectId: input.projectId,
    title: input.issueTitle,
    userId: input.userId,
  });
  const summary = buildAgentSummary(input.result);

  return appendIssueChatMessages(chatSession.id, [
    {
      body: input.userInstruction,
      role: "user",
    },
    {
      body: summary.body,
      role: "assistant",
      tone: summary.tone,
    },
  ]);
}

export async function POST(
  request: Request,
  context: IssueSandboxRouteContext,
) {
  const access = await getOwnedIssueProject(request, context);

  if ("response" in access) {
    const routeResponse = access.response!;
    return mapOwnershipFailure(routeResponse.status);
  }

  const body = await readJsonObject(request);
  const sessionId = readStringField(body, "sessionId");
  const instruction = readStringField(body, "instruction");

  if (!sessionId) {
    return jsonFailure("Start the sandbox first so Devin has a live workspace.", 400);
  }

  if (
    !(await verifyIssueSandboxAccess({
      projectId: access.project.id,
      sessionId,
      userId: access.userId,
    }))
  ) {
    return jsonFailure(
      "This sandbox session is no longer available. Start a fresh sandbox and try again.",
      404,
    );
  }

  if (!instruction) {
    return jsonFailure("Add an instruction before starting the sandbox agent.", 400);
  }

  const issueResult = await fetchProjectIssue(
    access.project.repoOwner,
    access.project.repoName,
    access.issueNumber,
  );

  if (issueResult.status !== "ok") {
    return mapIssueFailure(issueResult.status);
  }

  const agentStream = createAgentStream();

  void (async () => {
    try {
      const result = await runSandboxAgent(
        {
          issueNumber: access.issueNumber,
          issueTitle: issueResult.issue.title,
          projectId: access.project.id,
          repoName: access.project.repoName,
          repoOwner: access.project.repoOwner,
          sessionId,
          userInstruction: instruction,
        },
        {
          onProgress(event) {
            agentStream.send(event);
          },
        },
      );

      if (result.usage) {
        console.log("Sandbox agent usage:", {
          issueNumber: access.issueNumber,
          projectId: access.project.id,
          status: result.status,
          usage: result.usage,
        });
      }

      let chatMessages:
        | Awaited<ReturnType<typeof appendIssueChatMessages>>
        | undefined;

      if (result.status !== "failed") {
        try {
          chatMessages = await persistAgentChatMessages({
            issueNumber: access.issueNumber,
            issueTitle: issueResult.issue.title,
            projectId: access.project.id,
            result,
            userId: access.userId,
            userInstruction: instruction,
          });
        } catch (error) {
          console.error("Sandbox agent chat persistence failed:", error);
        }
      }

      revalidateProjectGitHubReads({
        issueNumber: access.issueNumber,
        repoName: access.project.repoName,
        repoOwner: access.project.repoOwner,
      });

      const { failureCode: _failureCode, ...publicResult } = result;

      if (result.status === "failed") {
        agentStream.send({
          message: result.message,
          type: "error",
        });
        return;
      }

      agentStream.send({
        result: {
          ...publicResult,
          ...(chatMessages ? { messages: chatMessages } : {}),
        },
        type: "final",
      });
    } catch (error) {
      console.error("Sandbox agent stream failed:", error);
      agentStream.send({
        message: "The sandbox agent could not finish this request.",
        type: "error",
      });
    } finally {
      agentStream.close();
    }
  })();

  return new Response(agentStream.stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
    },
  });
}
