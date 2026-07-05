import { type NextRequest, NextResponse } from "next/server";

import { getAuth } from "~/server/auth/session";
import { getRepoInstallationAccessToken } from "~/server/github/app-auth";
import { revalidateProjectGitHubReads } from "~/server/github/cache";
import { createProjectIssue } from "~/server/github/issues";
import { getOwnedProject } from "~/server/projects";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { userId } = await getAuth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const project = await getOwnedProject(id, userId);

  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const rawBody = body as Record<string, unknown>;
  const title =
    typeof rawBody.title === "string" ? rawBody.title.trim() : "";
  const description =
    typeof rawBody.description === "string" ? rawBody.description.trim() : undefined;

  if (!title) {
    return NextResponse.json(
      { error: "Title is required." },
      { status: 400 },
    );
  }

  if (title.length > 256) {
    return NextResponse.json(
      { error: "Title must be 256 characters or fewer." },
      { status: 400 },
    );
  }

  const installationToken = await getRepoInstallationAccessToken(
    project.repoOwner,
    project.repoName,
  );

  if (!installationToken) {
    return NextResponse.json(
      { error: "GitHub App installation access is missing for this repository." },
      { status: 403 },
    );
  }

  try {
    const issue = await createProjectIssue({
      body: description,
      installationToken,
      repoName: project.repoName,
      repoOwner: project.repoOwner,
      title,
    });

    revalidateProjectGitHubReads({
      repoName: project.repoName,
      repoOwner: project.repoOwner,
    });

    return NextResponse.json({ issue, ok: true });
  } catch (error) {
    const message =
      error instanceof Error && error.message === "github_access_missing"
        ? "GitHub App does not have access to create issues in this repository."
        : "Failed to create the issue on GitHub. Please try again.";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
