export type ParsedSseEvent = {
  data: string;
  event: string;
};

export function parseSseFrames(buffer: string): {
  events: ParsedSseEvent[];
  remaining: string;
} {
  const normalized = buffer.replaceAll("\r\n", "\n");
  const frames = normalized.split("\n\n");
  const remaining = frames.pop() ?? "";

  return {
    events: frames.flatMap((frame) => {
      const lines = frame.split("\n");
      const eventLine = lines.find((line) => line.startsWith("event:"));
      const dataLines = lines.filter((line) => line.startsWith("data:"));
      const data = dataLines
        .map((line) => line.slice("data:".length).trimStart())
        .join("\n");

      if (!data) {
        return [];
      }

      return [
        {
          data,
          event: eventLine?.slice("event:".length).trim() || "message",
        },
      ];
    }),
    remaining,
  };
}

