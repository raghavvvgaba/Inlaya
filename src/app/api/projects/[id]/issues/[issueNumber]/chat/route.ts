import { NextResponse } from "next/server";

import { clearIssueChatMessages } from "~/server/chat";
import { getAuth } from "~/server/auth/session";
import { getOwnedProject } from "~/server/projects";

type RouteParams = {
  params: Promise<{ id: string; issueNumber: string }>;
};

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { userId } = await getAuth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id, issueNumber: rawIssueNumber } = await params;
  const issueNumber = Number(rawIssueNumber);
  const project = await getOwnedProject(id, userId);

  if (!project || Number.isNaN(issueNumber)) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const result = await clearIssueChatMessages({
    issueNumber,
    projectId: project.id,
  });

  return NextResponse.json({
    deletedCount: result.deletedCount,
    ok: true,
  });
}
