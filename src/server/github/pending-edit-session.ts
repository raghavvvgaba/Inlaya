import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";

import { cookies } from "next/headers";

import { env } from "~/env";

const GITHUB_PENDING_EDIT_COOKIE = "github_pending_edit";
const PENDING_EDIT_MAX_AGE_SECONDS = 60 * 20;

export type PendingProjectEdit = {
  expiresAt: number;
  filePath: string;
  issueNumber: number;
  issueTitle: string;
  originalContent: string;
  originalSha: string;
  projectId: string;
  repoName: string;
  repoOwner: string;
  updatedContent: string;
};

function createEncryptionKey() {
  return createHash("sha256")
    .update(`${env.CLERK_SECRET_KEY}:${env.GITHUB_APP_PRIVATE_KEY}`)
    .digest();
}

function encryptPayload(payload: PendingProjectEdit) {
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
    throw new Error("invalid_pending_edit");
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

  return JSON.parse(inflateRawSync(decrypted).toString("utf8")) as PendingProjectEdit;
}

export async function writePendingProjectEdit(
  payload: Omit<PendingProjectEdit, "expiresAt">,
) {
  const cookieStore = await cookies();
  const expiresAt = Date.now() + PENDING_EDIT_MAX_AGE_SECONDS * 1000;
  const encryptedValue = encryptPayload({ ...payload, expiresAt });

  cookieStore.set(GITHUB_PENDING_EDIT_COOKIE, encryptedValue, {
    httpOnly: true,
    maxAge: PENDING_EDIT_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
  });
}

export async function readPendingProjectEdit(
  projectId?: string,
  issueNumber?: number,
) {
  const cookieStore = await cookies();
  const value = cookieStore.get(GITHUB_PENDING_EDIT_COOKIE)?.value;

  if (!value) {
    return null;
  }

  try {
    const payload = decryptPayload(value);

    if (payload.expiresAt <= Date.now()) {
      cookieStore.delete(GITHUB_PENDING_EDIT_COOKIE);
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
    cookieStore.delete(GITHUB_PENDING_EDIT_COOKIE);
    return null;
  }
}

export async function clearPendingProjectEdit(
  projectId?: string,
  issueNumber?: number,
) {
  const cookieStore = await cookies();

  if (!projectId) {
    cookieStore.delete(GITHUB_PENDING_EDIT_COOKIE);
    return;
  }

  const payload = await readPendingProjectEdit(projectId, issueNumber);

  if (payload) {
    cookieStore.delete(GITHUB_PENDING_EDIT_COOKIE);
  }
}
