import { db } from "~/server/db";
import type { SandboxAgentConversationMessage } from "~/server/sandbox/types";

type PersistedChatMessage = {
  body: string;
  id: string;
  role: "assistant" | "system" | "user";
  tone?: "default" | "error" | "success" | "warning";
};

type NewChatMessage = Omit<PersistedChatMessage, "id">;

function toPersistedChatMessage(message: {
  body: string;
  id: string;
  role: string;
  tone: string | null;
}): PersistedChatMessage {
  return {
    body: message.body,
    id: message.id,
    role: message.role as PersistedChatMessage["role"],
    tone: message.tone
      ? (message.tone as NonNullable<PersistedChatMessage["tone"]>)
      : undefined,
  };
}

export async function getOrCreateIssueChatSession(input: {
  issueNumber: number;
  projectId: string;
  title?: string;
  userId: string;
}) {
  return db.chatSession.upsert({
    create: {
      issueNumber: input.issueNumber,
      projectId: input.projectId,
      title: input.title,
      userId: input.userId,
    },
    update: input.title ? { title: input.title } : {},
    where: {
      projectId_issueNumber: {
        issueNumber: input.issueNumber,
        projectId: input.projectId,
      },
    },
  });
}

export async function getIssueChatMessages(sessionId: string) {
  const messages = await db.chatMessage.findMany({
    orderBy: {
      createdAt: "asc",
    },
    where: {
      sessionId,
    },
  });

  return messages.map(toPersistedChatMessage);
}

export function toSandboxAgentConversationHistory(
  messages: PersistedChatMessage[],
): SandboxAgentConversationMessage[] {
  return messages.flatMap((message) =>
    message.role === "assistant" || message.role === "user"
      ? [
          {
            content: message.body,
            role: message.role,
          },
        ]
      : [],
  );
}

export async function clearIssueChatMessages(input: {
  issueNumber: number;
  projectId: string;
}) {
  const chatSession = await db.chatSession.findUnique({
    select: {
      id: true,
    },
    where: {
      projectId_issueNumber: {
        issueNumber: input.issueNumber,
        projectId: input.projectId,
      },
    },
  });

  if (!chatSession) {
    return { deletedCount: 0 };
  }

  const result = await db.chatMessage.deleteMany({
    where: {
      sessionId: chatSession.id,
    },
  });

  return { deletedCount: result.count };
}

export async function appendIssueChatMessages(
  sessionId: string,
  messages: NewChatMessage[],
) {
  const createdMessages = await db.$transaction(
    messages.map((message) =>
      db.chatMessage.create({
        data: {
          body: message.body,
          role: message.role,
          sessionId,
          tone: message.tone,
        },
      }),
    ),
  );

  return createdMessages.map(toPersistedChatMessage);
}
