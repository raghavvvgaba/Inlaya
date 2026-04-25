import type { AIChatDiffPreview } from "~/components/ui/ai-chat";

function splitLines(value: string) {
  return value.replace(/\r\n/g, "\n").split("\n");
}

export function buildIssueChatDiffPreview(
  filePath: string,
  summary: string,
  originalContent: string,
  updatedContent: string,
): AIChatDiffPreview {
  const before = splitLines(originalContent);
  const after = splitLines(updatedContent);

  let prefix = 0;

  while (
    prefix < before.length &&
    prefix < after.length &&
    before[prefix] === after[prefix]
  ) {
    prefix += 1;
  }

  let suffix = 0;

  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  return {
    addedLines: after.slice(prefix, after.length - suffix),
    contextAfter: after.slice(
      after.length - suffix,
      Math.min(after.length, after.length - suffix + 2),
    ),
    contextBefore: before.slice(Math.max(0, prefix - 2), prefix),
    filePath,
    removedLines: before.slice(prefix, before.length - suffix),
    summary,
  };
}
