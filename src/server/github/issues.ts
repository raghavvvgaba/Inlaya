import { unstable_cache } from "next/cache";

import { getIssueTag, getRepoIssuesTag } from "~/server/github/cache";
import { GITHUB_API_VERSION } from "~/server/github/constants";
import { getRepoInstallationAccessToken } from "~/server/github/app-auth";

type GithubIssueResponse = {
  id: number;
  number: number;
  title: string;
  html_url: string;
  body: string | null;
  created_at: string;
  state: string;
  updated_at: string;
  comments: number;
  user: {
    login: string;
  };
  pull_request?: {
    url: string;
  };
};

export type ProjectIssue = {
  author: string;
  body: string | null;
  comments: number;
  createdAt: string;
  id: number;
  number: number;
  state: string;
  title: string;
  updatedAt: string;
  url: string;
};

export type ProjectIssuesResult =
  | {
      issues: ProjectIssue[];
      status: "ok";
    }
  | {
      issues: [];
      status: "missing_access" | "error";
    };

export type ProjectIssueResult =
  | {
      issue: ProjectIssue;
      status: "ok";
    }
  | {
      issue: null;
      status: "missing_access" | "error" | "not_found";
    };

export async function fetchProjectOpenIssues(
  repoOwner: string,
  repoName: string,
): Promise<ProjectIssuesResult> {
  return unstable_cache(
    async () => {
      const installationToken = await getRepoInstallationAccessToken(
        repoOwner,
        repoName,
      );

      if (!installationToken) {
        return {
          issues: [],
          status: "missing_access",
        } satisfies ProjectIssuesResult;
      }

      const response = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/issues?state=open&per_page=10`,
        {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${installationToken}`,
            "User-Agent": "devin-app",
            "X-GitHub-Api-Version": GITHUB_API_VERSION,
          },
        },
      );

      if (response.status === 404 || response.status === 403) {
        return {
          issues: [],
          status: "missing_access",
        } satisfies ProjectIssuesResult;
      }

      if (!response.ok) {
        return {
          issues: [],
          status: "error",
        } satisfies ProjectIssuesResult;
      }

      const issues = ((await response.json()) as GithubIssueResponse[])
        .filter((issue) => !issue.pull_request)
        .slice(0, 10)
        .map<ProjectIssue>((issue) => ({
          author: issue.user.login,
          body: issue.body,
          comments: issue.comments,
          createdAt: issue.created_at,
          id: issue.id,
          number: issue.number,
          state: issue.state,
          title: issue.title,
          updatedAt: issue.updated_at,
          url: issue.html_url,
        }));

      return {
        issues,
        status: "ok",
      } satisfies ProjectIssuesResult;
    },
    ["github-open-issues", repoOwner.toLowerCase(), repoName.toLowerCase()],
    {
      revalidate: 60,
      tags: [getRepoIssuesTag(repoOwner, repoName)],
    },
  )();
}

export async function fetchProjectIssue(
  repoOwner: string,
  repoName: string,
  issueNumber: number,
): Promise<ProjectIssueResult> {
  return unstable_cache(
    async () => {
      const installationToken = await getRepoInstallationAccessToken(
        repoOwner,
        repoName,
      );

      if (!installationToken) {
        return {
          issue: null,
          status: "missing_access",
        } satisfies ProjectIssueResult;
      }

      const response = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/issues/${issueNumber}`,
        {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${installationToken}`,
            "User-Agent": "devin-app",
            "X-GitHub-Api-Version": GITHUB_API_VERSION,
          },
        },
      );

      if (response.status === 404) {
        return {
          issue: null,
          status: "not_found",
        } satisfies ProjectIssueResult;
      }

      if (response.status === 403) {
        return {
          issue: null,
          status: "missing_access",
        } satisfies ProjectIssueResult;
      }

      if (!response.ok) {
        return {
          issue: null,
          status: "error",
        } satisfies ProjectIssueResult;
      }

      const issue = (await response.json()) as GithubIssueResponse;

      if (issue.pull_request) {
        return {
          issue: null,
          status: "not_found",
        } satisfies ProjectIssueResult;
      }

      return {
        issue: {
          author: issue.user.login,
          body: issue.body,
          comments: issue.comments,
          createdAt: issue.created_at,
          id: issue.id,
          number: issue.number,
          state: issue.state,
          title: issue.title,
          updatedAt: issue.updated_at,
          url: issue.html_url,
        },
        status: "ok",
      } satisfies ProjectIssueResult;
    },
    [
      "github-issue",
      repoOwner.toLowerCase(),
      repoName.toLowerCase(),
      String(issueNumber),
    ],
    {
      revalidate: 60,
      tags: [getIssueTag(repoOwner, repoName, issueNumber)],
    },
  )();
}

export type CreateIssueResult = {
  number: number;
  title: string;
  url: string;
};

export async function createProjectIssue(input: {
  body?: string;
  installationToken: string;
  repoName: string;
  repoOwner: string;
  title: string;
}): Promise<CreateIssueResult> {
  const response = await fetch(
    `https://api.github.com/repos/${input.repoOwner}/${input.repoName}/issues`,
    {
      body: JSON.stringify({
        body: input.body ?? "",
        title: input.title,
      }),
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${input.installationToken}`,
        "Content-Type": "application/json",
        "User-Agent": "devin-app",
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
      },
      method: "POST",
    },
  );

  if (response.status === 403 || response.status === 404) {
    throw new Error("github_access_missing");
  }

  if (!response.ok) {
    throw new Error("github_create_issue_failed");
  }

  const issue = (await response.json()) as {
    html_url: string;
    number: number;
    title: string;
  };

  return {
    number: issue.number,
    title: issue.title,
    url: issue.html_url,
  };
}
