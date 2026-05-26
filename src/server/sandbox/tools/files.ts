import "server-only";

export const MAX_SANDBOX_FILE_BYTES = 512 * 1024;

export function assertSandboxFileContentSize(content: string) {
  const size = Buffer.byteLength(content, "utf8");

  if (size > MAX_SANDBOX_FILE_BYTES) {
    throw new Error("file_too_large");
  }

  return size;
}
