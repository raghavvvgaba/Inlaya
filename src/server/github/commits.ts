import { GITHUB_API_VERSION } from "~/server/github/constants";
import { getRepoInstallationAccessToken } from "~/server/github/app-auth";

type GithubRepoResponse = {
  default_branch: string;
};

type GithubBranchResponse = {
  commit: {
    sha: string;
  };
};

type GithubCommitResponse = {
  commit: {
    sha: string;
  };
};

type CommitPreparedEditInput = {
  filePath: string;
  issueNumber: number;
  originalSha: string;
  repoName: string;
  repoOwner: string;
  updatedContent: string;
};

function encodeGithubPath(filePath: string) {
  return filePath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export type CommitPreparedEditResult =
  | {
      branchName: string;
      commitSha: string;
      status: "ok";
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

function getBranchName(issueNumber: number) {
  return `issue-${issueNumber}-hello-world`;
}

async function getDefaultBranchState(
  repoOwner: string,
  repoName: string,
  accessToken: string,
) {
  const repoResponse = await githubInstallationFetch(
    `/repos/${repoOwner}/${repoName}`,
    accessToken,
  );

  if (repoResponse.status === 404 || repoResponse.status === 403) {
    return { status: "missing_access" as const };
  }

  if (!repoResponse.ok) {
    return { status: "error" as const };
  }

  const repo = (await repoResponse.json()) as GithubRepoResponse;
  const branchResponse = await githubInstallationFetch(
    `/repos/${repoOwner}/${repoName}/branches/${encodeURIComponent(repo.default_branch)}`,
    accessToken,
  );

  if (branchResponse.status === 404 || branchResponse.status === 403) {
    return { status: "missing_access" as const };
  }

  if (!branchResponse.ok) {
    return { status: "error" as const };
  }

  const branch = (await branchResponse.json()) as GithubBranchResponse;

  return {
    defaultBranch: repo.default_branch,
    sha: branch.commit.sha,
    status: "ok" as const,
  };
}

async function ensureBranchExists(
  repoOwner: string,
  repoName: string,
  branchName: string,
  baseSha: string,
  accessToken: string,
) {
  const response = await githubInstallationFetch(
    `/repos/${repoOwner}/${repoName}/git/refs`,
    accessToken,
    {
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: baseSha,
      }),
      method: "POST",
    },
  );

  if (response.status === 422) {
    return { status: "ok" as const };
  }

  if (response.status === 404 || response.status === 403) {
    return { status: "missing_access" as const };
  }

  if (!response.ok) {
    return { status: "error" as const };
  }

  return { status: "ok" as const };
}

export async function commitPreparedEdit(
  input: CommitPreparedEditInput,
): Promise<CommitPreparedEditResult> {
  const installationToken = await getRepoInstallationAccessToken(
    input.repoOwner,
    input.repoName,
  );

  if (!installationToken) {
    return { status: "missing_access" };
  }

  const branchState = await getDefaultBranchState(
    input.repoOwner,
    input.repoName,
    installationToken,
  );

  if (branchState.status !== "ok") {
    return { status: branchState.status };
  }

  const branchName = getBranchName(input.issueNumber);
  const branchResult = await ensureBranchExists(
    input.repoOwner,
    input.repoName,
    branchName,
    branchState.sha,
    installationToken,
  );

  if (branchResult.status !== "ok") {
    return { status: branchResult.status };
  }

  const response = await githubInstallationFetch(
    `/repos/${input.repoOwner}/${input.repoName}/contents/${encodeGithubPath(input.filePath)}`,
    installationToken,
    {
      body: JSON.stringify({
        branch: branchName,
        content: Buffer.from(input.updatedContent, "utf8").toString("base64"),
        message: `Append hello world to ${input.filePath} for #${input.issueNumber}`,
        sha: input.originalSha,
      }),
      method: "PUT",
    },
  );

  if (response.status === 404 || response.status === 403) {
    return { status: "missing_access" };
  }

  if (!response.ok) {
    return { status: "error" };
  }

  const data = (await response.json()) as GithubCommitResponse;

  return {
    branchName,
    commitSha: data.commit.sha,
    status: "ok",
  };
}
