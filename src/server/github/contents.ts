import { GITHUB_API_VERSION } from "~/server/github/constants";
import { generateSingleFileEdit } from "~/server/ai/openrouter";
import { getRepoInstallationAccessToken } from "~/server/github/app-auth";

type GithubContentResponse = {
  content: string;
  encoding: string;
  path: string;
  sha: string;
  type: string;
};

function encodeGithubPath(filePath: string) {
  return filePath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export type PreparedProjectEdit =
  | {
      filePath: string;
      model: string;
      originalContent: string;
      originalSha: string;
      status: "ok";
      summary: string;
      updatedContent: string;
    }
  | {
      status:
        | "error"
        | "file_not_found"
        | "invalid_response"
        | "missing_access"
        | "missing_api_key"
        | "model_error"
        | "no_changes"
        | "unsupported_file";
    };

function decodeGithubContent(content: string, encoding: string) {
  if (encoding !== "base64") {
    throw new Error("unsupported_github_content_encoding");
  }

  return Buffer.from(content.replaceAll("\n", ""), "base64").toString("utf8");
}

export async function prepareSingleFileAiEdit(
  repoOwner: string,
  repoName: string,
  filePath: string,
  issueTitle: string,
  userInstruction: string,
): Promise<PreparedProjectEdit> {
  const installationToken = await getRepoInstallationAccessToken(
    repoOwner,
    repoName,
  );

  if (!installationToken) {
    return { status: "missing_access" };
  }

  const response = await fetch(
    `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${encodeGithubPath(filePath)}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${installationToken}`,
        "User-Agent": "devin-app",
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
      },
      cache: "no-store",
    },
  );

  if (response.status === 404) {
    return { status: "file_not_found" };
  }

  if (response.status === 403) {
    return { status: "missing_access" };
  }

  if (!response.ok) {
    return { status: "error" };
  }

  const contentData = (await response.json()) as GithubContentResponse;

  if (contentData.type !== "file") {
    return { status: "file_not_found" };
  }

  try {
    const originalContent = decodeGithubContent(
      contentData.content,
      contentData.encoding,
    );
    const aiEdit = await generateSingleFileEdit({
      filePath: contentData.path,
      issueTitle,
      originalContent,
      repoName,
      repoOwner,
      userInstruction,
    });

    if (aiEdit.status !== "ok") {
      return { status: aiEdit.status };
    }

    return {
      filePath: contentData.path,
      model: aiEdit.model,
      originalContent,
      originalSha: contentData.sha,
      status: "ok",
      summary: aiEdit.summary,
      updatedContent: aiEdit.updatedContent,
    };
  } catch {
    return { status: "error" };
  }
}
