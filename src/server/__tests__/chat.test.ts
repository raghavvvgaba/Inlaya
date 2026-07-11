import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  chatMessageDeleteMany: vi.fn(),
  chatSessionFindUnique: vi.fn(),
}));

vi.mock("~/server/db", () => ({
  db: {
    chatMessage: {
      deleteMany: mocks.chatMessageDeleteMany,
    },
    chatSession: {
      findUnique: mocks.chatSessionFindUnique,
    },
  },
}));

const { clearIssueChatMessages, toSandboxAgentConversationHistory } =
  await import("~/server/chat");

describe("toSandboxAgentConversationHistory", () => {
  it("keeps ordered user and assistant messages and excludes system messages", () => {
    expect(
      toSandboxAgentConversationHistory([
        {
          body: "Rename the profile card name to Dev.",
          id: "message-1",
          role: "user",
        },
        {
          body: "Sandbox started.",
          id: "message-2",
          role: "system",
          tone: "default",
        },
        {
          body: "Switch to Build mode to apply the rename.",
          id: "message-3",
          role: "assistant",
          tone: "warning",
        },
      ]),
    ).toEqual([
      {
        content: "Rename the profile card name to Dev.",
        role: "user",
      },
      {
        content: "Switch to Build mode to apply the rename.",
        role: "assistant",
      },
    ]);
  });

  it("returns an empty history after all chat messages are cleared", () => {
    expect(toSandboxAgentConversationHistory([])).toEqual([]);
  });
});

describe("clearIssueChatMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes only messages attached to the matching issue chat session", async () => {
    mocks.chatSessionFindUnique.mockResolvedValueOnce({ id: "session-1" });
    mocks.chatMessageDeleteMany.mockResolvedValueOnce({ count: 2 });

    await expect(
      clearIssueChatMessages({
        issueNumber: 12,
        projectId: "project-1",
      }),
    ).resolves.toEqual({ deletedCount: 2 });

    expect(mocks.chatSessionFindUnique).toHaveBeenCalledWith({
      select: {
        id: true,
      },
      where: {
        projectId_issueNumber: {
          issueNumber: 12,
          projectId: "project-1",
        },
      },
    });
    expect(mocks.chatMessageDeleteMany).toHaveBeenCalledWith({
      where: {
        sessionId: "session-1",
      },
    });
  });

  it("treats a missing chat session as an empty clear", async () => {
    mocks.chatSessionFindUnique.mockResolvedValueOnce(null);

    await expect(
      clearIssueChatMessages({
        issueNumber: 13,
        projectId: "project-1",
      }),
    ).resolves.toEqual({ deletedCount: 0 });

    expect(mocks.chatMessageDeleteMany).not.toHaveBeenCalled();
  });
});
