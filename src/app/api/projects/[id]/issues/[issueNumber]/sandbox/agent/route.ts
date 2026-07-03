import { NextResponse } from "next/server";

import {
  appendIssueChatMessages,
  getOrCreateIssueChatSession,
} from "~/server/chat";
import { revalidateProjectGitHubReads } from "~/server/github/cache";
import { fetchProjectIssue } from "~/server/github/issues";
import { runSandboxAgent } from "~/server/sandbox/agent";
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

function mapAgentFailureStatusCode(result: Awaited<ReturnType<typeof runSandboxAgent>>) {
  if (result.status !== "failed") {
    return 200;
  }

  switch (result.failureCode) {
    case "model_rate_limited":
      return 429;
    case "model_unavailable":
      return 503;
    case "sandbox_not_running":
      return 409;
    default:
      return 500;
  }
}

function buildAgentSummary(result: Awaited<ReturnType<typeof runSandboxAgent>>) {
  const filesTouched =
    result.filesTouched.length > 0
      ? `Files touched: ${result.filesTouched.join(", ")}`
      : "Files touched: none";
  const clarification = result.clarificationQuestion
    ? `\n\nClarification needed: ${result.clarificationQuestion}`
    : "";

  switch (result.status) {
    case "completed":
      return {
        body: `Sandbox agent completed.\n\n${result.message}\n\n${filesTouched}`,
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

  const result = await runSandboxAgent({
    issueNumber: access.issueNumber,
    issueTitle: issueResult.issue.title,
    projectId: access.project.id,
    repoName: access.project.repoName,
    repoOwner: access.project.repoOwner,
    sessionId,
    userInstruction: instruction,
  });

  if (result.usage) {
    console.log("Sandbox agent usage:", {
      issueNumber: access.issueNumber,
      projectId: access.project.id,
      status: result.status,
      usage: result.usage,
    });
  }

  let chatMessages: Awaited<ReturnType<typeof appendIssueChatMessages>> | undefined;

  try {
    const chatSession = await getOrCreateIssueChatSession({
      issueNumber: access.issueNumber,
      projectId: access.project.id,
      title: issueResult.issue.title,
      userId: access.userId,
    });
    const summary = buildAgentSummary(result);

    chatMessages = await appendIssueChatMessages(chatSession.id, [
      {
        body: instruction,
        role: "user",
      },
      {
        body: summary.body,
        role: "assistant",
        tone: summary.tone,
      },
    ]);
  } catch (error) {
    console.error("Sandbox agent chat persistence failed:", error);
  }

  revalidateProjectGitHubReads({
    issueNumber: access.issueNumber,
    repoName: access.project.repoName,
    repoOwner: access.project.repoOwner,
  });

  const { failureCode: _failureCode, ...publicResult } = result;

  return NextResponse.json(
    {
      ...publicResult,
      ...(chatMessages ? { messages: chatMessages } : {}),
    },
    { status: mapAgentFailureStatusCode(result) },
  );
}
