"use server";

import { getAuth } from "~/server/auth/session";
import { getGithubConnectionStatus } from "~/server/github/connection";
import { readGithubImportSession } from "~/server/github/import-session";
import { fetchImportRepositories, fetchGithubViewerLogin } from "~/server/github/repos";
import { listImportedProjectsForUser } from "~/server/projects";

const newProjectErrorMessages: Record<string, string> = {
  github_required: "Connect GitHub before importing.",
  github_repo_fetch_failed: "Could not fetch repository list.",
  missing_repo_selection: "Choose a repository.",
  refresh_import_session: "Session expired. Refresh access.",
  repo_needs_access: "Grant the GitHub App access first.",
  repo_not_in_session: "Repo not in current session.",
};

export async function fetchImportModalData(owner?: string) {
  const { userId } = await getAuth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  const githubStatus = await getGithubConnectionStatus(userId);
  if (!githubStatus.connected) {
    return { hasSession: false, error: "github_required" };
  }

  const importSession = await readGithubImportSession();
  if (!importSession) {
    return { hasSession: false };
  }

  const importedProjects = await listImportedProjectsForUser(userId);
  const importedProjectsRecord = Object.fromEntries(
    importedProjects.map((project) => [
      `${project.repoOwner.toLowerCase()}/${project.repoName.toLowerCase()}`,
      project.id,
    ]),
  );

  let repoList: Awaited<ReturnType<typeof fetchImportRepositories>> | null = null;
  let viewerLogin: string | null = null;
  let sessionError: string | null = null;

  try {
    [repoList, viewerLogin] = await Promise.all([
      fetchImportRepositories(importSession.accessToken),
      fetchGithubViewerLogin(importSession.accessToken),
    ]);
  } catch {
    sessionError =
      newProjectErrorMessages.github_repo_fetch_failed ??
      "GitHub did not return the repository list. Refresh access and try again.";
  }

  const ownerOptions = repoList
    ? Array.from(new Set(repoList.map((repo) => repo.owner))).sort((a, b) => {
        if (viewerLogin && a.toLowerCase() === viewerLogin.toLowerCase()) {
          return -1;
        }

        if (viewerLogin && b.toLowerCase() === viewerLogin.toLowerCase()) {
          return 1;
        }

        return a.localeCompare(b);
      })
    : [];
    
  const selectedOwner =
    ownerOptions.find(
      (o) => owner?.toLowerCase() === o.toLowerCase(),
    ) ??
    ownerOptions.find(
      (o) => viewerLogin?.toLowerCase() === o.toLowerCase(),
    ) ??
    ownerOptions[0] ??
    "";
    
  const filteredRepos =
    repoList?.filter((repo) => repo.owner === selectedOwner) ?? [];

  return {
    hasSession: true,
    error: sessionError,
    filteredRepos,
    importedProjectsRecord,
    ownerOptions,
    selectedOwner,
  };
}
