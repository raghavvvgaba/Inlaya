import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";

import { cookies } from "next/headers";

import { env } from "~/env";

const GITHUB_POST_COMMIT_COOKIE = "github_post_commit";
const POST_COMMIT_MAX_AGE_SECONDS = 60 * 20;

export type PostCommitResult = {
  branchName: string;
  commitSha: string;
  expiresAt: number;
  filePath: string;
  issueNumber: number;
  projectId: string;
};

function createEncryptionKey() {
  return createHash("sha256")
    .update(`${env.CLERK_SECRET_KEY}:${env.GITHUB_APP_PRIVATE_KEY}:post-commit`)
    .digest();
}

function encryptPayload(payload: PostCommitResult) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", createEncryptionKey(), iv);
  const compressed = deflateRawSync(Buffer.from(JSON.stringify(payload), "utf8"));
  const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

function decryptPayload(value: string) {
  const [ivPart, tagPart, dataPart] = value.split(".");

  if (!ivPart || !tagPart || !dataPart) {
    throw new Error("invalid_post_commit");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    createEncryptionKey(),
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]);

  return JSON.parse(inflateRawSync(decrypted).toString("utf8")) as PostCommitResult;
}

export async function writePostCommitResult(
  payload: Omit<PostCommitResult, "expiresAt">,
) {
  const cookieStore = await cookies();
  const expiresAt = Date.now() + POST_COMMIT_MAX_AGE_SECONDS * 1000;
  const encryptedValue = encryptPayload({ ...payload, expiresAt });

  cookieStore.set(GITHUB_POST_COMMIT_COOKIE, encryptedValue, {
    httpOnly: true,
    maxAge: POST_COMMIT_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
  });
}

export async function readPostCommitResult(
  projectId?: string,
  issueNumber?: number,
) {
  const cookieStore = await cookies();
  const value = cookieStore.get(GITHUB_POST_COMMIT_COOKIE)?.value;

  if (!value) {
    return null;
  }

  try {
    const payload = decryptPayload(value);

    if (payload.expiresAt <= Date.now()) {
      cookieStore.delete(GITHUB_POST_COMMIT_COOKIE);
      return null;
    }

    if (projectId && payload.projectId !== projectId) {
      return null;
    }

    if (typeof issueNumber === "number" && payload.issueNumber !== issueNumber) {
      return null;
    }

    return payload;
  } catch {
    cookieStore.delete(GITHUB_POST_COMMIT_COOKIE);
    return null;
  }
}

export async function clearPostCommitResult(
  projectId?: string,
  issueNumber?: number,
) {
  const cookieStore = await cookies();

  if (!projectId) {
    cookieStore.delete(GITHUB_POST_COMMIT_COOKIE);
    return;
  }

  const payload = await readPostCommitResult(projectId, issueNumber);

  if (payload) {
    cookieStore.delete(GITHUB_POST_COMMIT_COOKIE);
  }
}
