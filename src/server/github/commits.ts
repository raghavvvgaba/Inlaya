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

type GithubContentResponse = {
  sha: string;
  type: string;
};

type GithubErrorResponse = {
  errors?: Array<{
    code?: string;
    field?: string;
    message?: string;
    resource?: string;
  }>;
  message?: string;
};

type CommitPreparedEditInput = {
  filePath: string;
  issueNumber: number;
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
      message?: string;
      status:
        | "branch_conflict"
        | "error"
        | "file_conflict"
        | "github_error"
        | "missing_access";
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
  return `issue-${issueNumber}-ai-edit`;
}

async function readGithubError(response: Response) {
  try {
    const data = (await response.json()) as GithubErrorResponse;
    const errorMessages = data.errors
      ?.map((error) => error.message ?? error.code)
      .filter(Boolean)
      .join("; ");

    return [data.message, errorMessages].filter(Boolean).join(": ");
  } catch {
    return response.statusText || `GitHub returned ${response.status}`;
  }
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
    return {
      message: await readGithubError(repoResponse),
      status: "github_error" as const,
    };
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
    return {
      message: await readGithubError(branchResponse),
      status: "github_error" as const,
    };
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
    const branchResponse = await githubInstallationFetch(
      `/repos/${repoOwner}/${repoName}/branches/${encodeURIComponent(branchName)}`,
      accessToken,
    );

    if (branchResponse.ok) {
      return { status: "already_exists" as const };
    }

    return {
      message: await readGithubError(response),
      status: "branch_conflict" as const,
    };
  }

  if (response.status === 404 || response.status === 403) {
    return { status: "missing_access" as const };
  }

  if (!response.ok) {
    return {
      message: await readGithubError(response),
      status: "github_error" as const,
    };
  }

  return { status: "created" as const };
}

async function getBranchFileState(
  repoOwner: string,
  repoName: string,
  branchName: string,
  filePath: string,
  accessToken: string,
) {
  const response = await githubInstallationFetch(
    `/repos/${repoOwner}/${repoName}/contents/${encodeGithubPath(filePath)}?ref=${encodeURIComponent(branchName)}`,
    accessToken,
  );

  if (response.status === 404) {
    return { status: "missing_file" as const };
  }

  if (response.status === 403) {
    return { status: "missing_access" as const };
  }

  if (!response.ok) {
    return {
      message: await readGithubError(response),
      status: "github_error" as const,
    };
  }

  const file = (await response.json()) as GithubContentResponse;

  if (file.type !== "file") {
    return {
      message: `${filePath} is not a file on ${branchName}`,
      status: "file_conflict" as const,
    };
  }

  return {
    sha: file.sha,
    status: "ok" as const,
  };
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
    return branchState;
  }

  const branchName = getBranchName(input.issueNumber);
  const branchResult = await ensureBranchExists(
    input.repoOwner,
    input.repoName,
    branchName,
    branchState.sha,
    installationToken,
  );

  if (
    branchResult.status !== "created" &&
    branchResult.status !== "already_exists"
  ) {
    return branchResult;
  }

  const branchFile = await getBranchFileState(
    input.repoOwner,
    input.repoName,
    branchName,
    input.filePath,
    installationToken,
  );

  if (branchFile.status !== "ok" && branchFile.status !== "missing_file") {
    return branchFile;
  }

  const response = await githubInstallationFetch(
    `/repos/${input.repoOwner}/${input.repoName}/contents/${encodeGithubPath(input.filePath)}`,
    installationToken,
    {
      body: JSON.stringify({
        branch: branchName,
        content: Buffer.from(input.updatedContent, "utf8").toString("base64"),
        message: `Update ${input.filePath} for #${input.issueNumber}`,
        ...(branchFile.status === "ok" ? { sha: branchFile.sha } : {}),
      }),
      method: "PUT",
    },
  );

  if (response.status === 404 || response.status === 403) {
    return { status: "missing_access" };
  }

  if (response.status === 409 || response.status === 422) {
    return {
      message: await readGithubError(response),
      status: "file_conflict",
    };
  }

  if (!response.ok) {
    return {
      message: await readGithubError(response),
      status: "github_error",
    };
  }

  const data = (await response.json()) as GithubCommitResponse;

  return {
    branchName,
    commitSha: data.commit.sha,
    status: "ok",
  };
}
