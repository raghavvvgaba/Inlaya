import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { prepareAppendHelloWorldEdit } from "~/server/github/contents";
import { clearPostCommitResult } from "~/server/github/post-commit-session";
import { writePendingProjectEdit } from "~/server/github/pending-edit-session";
import { fetchProjectIssue } from "~/server/github/issues";
import { getOwnedProject } from "~/server/projects";

type EditRouteContext = {
  params: Promise<{ id: string; issueNumber: string }>;
};

function redirectToIssueWithStatus(
  request: Request,
  projectId: string,
  issueNumber: number,
  key: "error" | "success",
  value: string,
) {
  const redirectUrl = new URL(
    `/projects/${projectId}/issues/${issueNumber}`,
    request.url,
  );
  redirectUrl.searchParams.set(key, value);
  return NextResponse.redirect(redirectUrl, { status: 303 });
}

async function getRequestedFilePath(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as { filePath?: unknown };
    return typeof body.filePath === "string" ? body.filePath : null;
  }

  const formData = await request.formData();
  const filePath = formData.get("filePath");

  return typeof filePath === "string" ? filePath : null;
}

async function handlePrepareEdit(request: Request, context: EditRouteContext) {
  const { userId, redirectToSignIn } = await auth();

  if (!userId) {
    return redirectToSignIn({ returnBackUrl: request.url });
  }

  const { id, issueNumber: rawIssueNumber } = await context.params;
  const issueNumber = Number(rawIssueNumber);
  const project = await getOwnedProject(id, userId);

  if (!project || Number.isNaN(issueNumber)) {
    return NextResponse.redirect(new URL("/dashboard", request.url), { status: 303 });
  }

  const filePath = (await getRequestedFilePath(request))?.trim();

  if (!filePath) {
    return redirectToIssueWithStatus(
      request,
      project.id,
      issueNumber,
      "error",
      "missing_file_path",
    );
  }

  const issueResult = await fetchProjectIssue(
    project.repoOwner,
    project.repoName,
    issueNumber,
  );

  if (issueResult.status !== "ok") {
    return redirectToIssueWithStatus(
      request,
      project.id,
      issueNumber,
      "error",
      issueResult.status === "missing_access"
        ? "edit_access_missing"
        : "issue_unavailable",
    );
  }

  const preparedEdit = await prepareAppendHelloWorldEdit(
    project.repoOwner,
    project.repoName,
    filePath,
  );

  if (preparedEdit.status !== "ok") {
    if (preparedEdit.status === "missing_access") {
      return redirectToIssueWithStatus(
        request,
        project.id,
        issueNumber,
        "error",
        "edit_access_missing",
      );
    }

    if (preparedEdit.status === "file_not_found") {
      return redirectToIssueWithStatus(
        request,
        project.id,
        issueNumber,
        "error",
        "file_not_found",
      );
    }

    return redirectToIssueWithStatus(
      request,
      project.id,
      issueNumber,
      "error",
      "edit_prepare_failed",
    );
  }

  await clearPostCommitResult(project.id, issueNumber);
  await writePendingProjectEdit({
    filePath: preparedEdit.filePath,
    issueNumber,
    issueTitle: issueResult.issue.title,
    originalContent: preparedEdit.originalContent,
    originalSha: preparedEdit.originalSha,
    projectId: project.id,
    repoName: project.repoName,
    repoOwner: project.repoOwner,
    updatedContent: preparedEdit.updatedContent,
  });

  return redirectToIssueWithStatus(
    request,
    project.id,
    issueNumber,
    "success",
    "edit_prepared",
  );
}

export async function PUT(request: Request, context: EditRouteContext) {
  return handlePrepareEdit(request, context);
}

export async function POST(request: Request, context: EditRouteContext) {
  return handlePrepareEdit(request, context);
}
