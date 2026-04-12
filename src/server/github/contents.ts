import { GITHUB_API_VERSION } from "~/server/github/constants";
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
      originalContent: string;
      originalSha: string;
      status: "ok";
      updatedContent: string;
    }
  | {
      status: "file_not_found" | "missing_access" | "error";
    };

function appendHelloWorld(content: string) {
  if (content.length === 0) {
    return "hello world\n";
  }

  if (content.endsWith("\n")) {
    return `${content}hello world\n`;
  }

  return `${content}\nhello world\n`;
}

function decodeGithubContent(content: string, encoding: string) {
  if (encoding !== "base64") {
    throw new Error("unsupported_github_content_encoding");
  }

  return Buffer.from(content.replaceAll("\n", ""), "base64").toString("utf8");
}

export async function prepareAppendHelloWorldEdit(
  repoOwner: string,
  repoName: string,
  filePath: string,
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

    return {
      filePath: contentData.path,
      originalContent,
      originalSha: contentData.sha,
      status: "ok",
      updatedContent: appendHelloWorld(originalContent),
    };
  } catch {
    return { status: "error" };
  }
}
