import "server-only";

import { GITHUB_API_VERSION } from "~/server/github/constants";

type GithubRepositoryResponse = {
  default_branch: string;
};

type GithubPullRequestResponse = {
  html_url: string;
  number: number;
};

export type ProjectPullRequest = {
  number: number;
  url: string;
};

async function githubInstallationFetch<T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "devin-app",
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    if (response.status === 403 || response.status === 404) {
      throw new Error("github_access_missing");
    }

    throw new Error("github_pull_request_failed");
  }

  return (await response.json()) as T;
}

export async function fetchRepositoryDefaultBranch(input: {
  installationToken: string;
  repoName: string;
  repoOwner: string;
}) {
  const repository = await githubInstallationFetch<GithubRepositoryResponse>(
    `/repos/${input.repoOwner}/${input.repoName}`,
    input.installationToken,
  );

  return repository.default_branch;
}

export async function findOpenPullRequestForBranch(input: {
  branchName: string;
  installationToken: string;
  repoName: string;
  repoOwner: string;
}): Promise<ProjectPullRequest | null> {
  const params = new URLSearchParams({
    head: `${input.repoOwner}:${input.branchName}`,
    per_page: "1",
    state: "open",
  });
  const pullRequests = await githubInstallationFetch<GithubPullRequestResponse[]>(
    `/repos/${input.repoOwner}/${input.repoName}/pulls?${params.toString()}`,
    input.installationToken,
  );
  const pullRequest = pullRequests[0];

  if (!pullRequest) {
    return null;
  }

  return {
    number: pullRequest.number,
    url: pullRequest.html_url,
  };
}

export async function createPullRequest(input: {
  baseBranch: string;
  body: string;
  branchName: string;
  installationToken: string;
  repoName: string;
  repoOwner: string;
  title: string;
}): Promise<ProjectPullRequest> {
  const pullRequest = await githubInstallationFetch<GithubPullRequestResponse>(
    `/repos/${input.repoOwner}/${input.repoName}/pulls`,
    input.installationToken,
    {
      body: JSON.stringify({
        base: input.baseBranch,
        body: input.body,
        head: input.branchName,
        title: input.title,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );

  return {
    number: pullRequest.number,
    url: pullRequest.html_url,
  };
}
