import { describe, expect, it } from "vitest";

import { formatSseEvent } from "../agent-stream";

describe("formatSseEvent", () => {
  it("formats named SSE events with JSON data", () => {
    expect(
      formatSseEvent({
        message: "Searching the codebase...",
        type: "progress",
      }),
    ).toBe(
      'event: progress\ndata: {"message":"Searching the codebase...","type":"progress"}\n\n',
    );
  });
});

