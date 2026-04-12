import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { commitPreparedEdit } from "~/server/github/commits";
import { clearPendingProjectEdit, readPendingProjectEdit } from "~/server/github/pending-edit-session";
import { writePostCommitResult } from "~/server/github/post-commit-session";
import { clearPullRequestResult } from "~/server/github/pull-request-session";
import { getOwnedProject } from "~/server/projects";

type CommitRouteContext = {
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

export async function POST(request: Request, context: CommitRouteContext) {
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

  const pendingEdit = await readPendingProjectEdit(project.id, issueNumber);

  if (!pendingEdit) {
    const projectScopedPendingEdit = await readPendingProjectEdit(project.id);

    return redirectToIssueWithStatus(
      request,
      project.id,
      issueNumber,
      "error",
      projectScopedPendingEdit ? "stale_pending_edit" : "pending_edit_missing",
    );
  }

  const commitResult = await commitPreparedEdit({
    filePath: pendingEdit.filePath,
    issueNumber,
    originalSha: pendingEdit.originalSha,
    repoName: project.repoName,
    repoOwner: project.repoOwner,
    updatedContent: pendingEdit.updatedContent,
  });

  if (commitResult.status !== "ok") {
    return redirectToIssueWithStatus(
      request,
      project.id,
      issueNumber,
      "error",
      commitResult.status === "missing_access"
        ? "commit_access_missing"
        : "commit_failed",
    );
  }

  await clearPullRequestResult(project.id, issueNumber);
  await writePostCommitResult({
    branchName: commitResult.branchName,
    commitSha: commitResult.commitSha,
    filePath: pendingEdit.filePath,
    issueNumber,
    projectId: project.id,
  });
  await clearPendingProjectEdit(project.id, issueNumber);

  return redirectToIssueWithStatus(
    request,
    project.id,
    issueNumber,
    "success",
    "commit_created",
  );
}
