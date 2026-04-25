import { GITHUB_API_VERSION } from "~/server/github/constants";
import { getRepoInstallationAccessToken } from "~/server/github/app-auth";

type GithubRepoResponse = {
  default_branch: string;
};

type GithubPullRequestResponse = {
  html_url: string;
  number: number;
};

type CreatePullRequestInput = {
  branchName: string;
  filePath: string;
  issueNumber: number;
  repoName: string;
  repoOwner: string;
};

export type CreatePullRequestResult =
  | {
      prNumber: number;
      prUrl: string;
      status: "ok" | "already_exists";
    }
  | {
      status: "missing_access" | "error";
    };

async function githubInstallationFetch(
  path: string,
  accessToken: string,
  init?: RequestInit,
) {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "User-Agent": "devin-app",
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}

async function getDefaultBranch(
  repoOwner: string,
  repoName: string,
  accessToken: string,
) {
  const response = await githubInstallationFetch(
    `/repos/${repoOwner}/${repoName}`,
    accessToken,
  );

  if (response.status === 404 || response.status === 403) {
    return { status: "missing_access" as const };
  }

  if (!response.ok) {
    return { status: "error" as const };
  }

  const repo = (await response.json()) as GithubRepoResponse;

  return {
    defaultBranch: repo.default_branch,
    status: "ok" as const,
  };
}

async function findExistingPullRequest(
  repoOwner: string,
  repoName: string,
  branchName: string,
  defaultBranch: string,
  accessToken: string,
) {
  const response = await githubInstallationFetch(
    `/repos/${repoOwner}/${repoName}/pulls?state=open&head=${encodeURIComponent(
      `${repoOwner}:${branchName}`,
    )}&base=${encodeURIComponent(defaultBranch)}`,
    accessToken,
  );

  if (response.status === 404 || response.status === 403) {
    return { status: "missing_access" as const };
  }

  if (!response.ok) {
    return { status: "error" as const };
  }

  const pullRequests = (await response.json()) as GithubPullRequestResponse[];
  const existingPullRequest = pullRequests[0];

  if (!existingPullRequest) {
    return { status: "none" as const };
  }

  return {
    prNumber: existingPullRequest.number,
    prUrl: existingPullRequest.html_url,
    status: "already_exists" as const,
  };
}

export async function createPullRequestForIssue(
  input: CreatePullRequestInput,
): Promise<CreatePullRequestResult> {
  const installationToken = await getRepoInstallationAccessToken(
    input.repoOwner,
    input.repoName,
  );

  if (!installationToken) {
    return { status: "missing_access" };
  }

  const repoState = await getDefaultBranch(
    input.repoOwner,
    input.repoName,
    installationToken,
  );

  if (repoState.status !== "ok") {
    return { status: repoState.status };
  }

  const existingPullRequest = await findExistingPullRequest(
    input.repoOwner,
    input.repoName,
    input.branchName,
    repoState.defaultBranch,
    installationToken,
  );

  if (existingPullRequest.status === "already_exists") {
    return existingPullRequest;
  }

  if (existingPullRequest.status !== "none") {
    return { status: existingPullRequest.status };
  }

  const response = await githubInstallationFetch(
    `/repos/${input.repoOwner}/${input.repoName}/pulls`,
    installationToken,
    {
      body: JSON.stringify({
        base: repoState.defaultBranch,
        body: [
          "## Summary",
          `- Issue: #${input.issueNumber}`,
          `- File changed: ${input.filePath}`,
          "- Change: applies an AI-generated single-file update using the issue workflow",
        ].join("\n"),
        draft: false,
        head: input.branchName,
        title: `Fix #${input.issueNumber}: update ${input.filePath}`,
      }),
      method: "POST",
    },
  );

  if (response.status === 404 || response.status === 403) {
    return { status: "missing_access" };
  }

  if (response.status === 422) {
    const duplicatePullRequest = await findExistingPullRequest(
      input.repoOwner,
      input.repoName,
      input.branchName,
      repoState.defaultBranch,
      installationToken,
    );

    if (duplicatePullRequest.status === "already_exists") {
      return duplicatePullRequest;
    }
  }

  if (!response.ok) {
    return { status: "error" };
  }

  const data = (await response.json()) as GithubPullRequestResponse;

  return {
    prNumber: data.number,
    prUrl: data.html_url,
    status: "ok",
  };
}
