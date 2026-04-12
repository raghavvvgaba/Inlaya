import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { clearPendingProjectEdit } from "~/server/github/pending-edit-session";
import { getOwnedProject } from "~/server/projects";

type CancelRouteContext = {
  params: Promise<{ id: string; issueNumber: string }>;
};

export async function POST(request: Request, context: CancelRouteContext) {
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

  await clearPendingProjectEdit(project.id, issueNumber);

  const redirectUrl = new URL(
    `/projects/${project.id}/issues/${issueNumber}`,
    request.url,
  );
  redirectUrl.searchParams.set("success", "edit_cleared");

  return NextResponse.redirect(redirectUrl, { status: 303 });
}
