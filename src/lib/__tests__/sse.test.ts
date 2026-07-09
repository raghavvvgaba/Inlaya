import { describe, expect, it } from "vitest";

import { parseSseFrames } from "../sse";

describe("parseSseFrames", () => {
  it("parses multiple frames and preserves incomplete data", () => {
    const result = parseSseFrames(
      [
        'event: progress\ndata: {"type":"progress","message":"Searching"}',
        "",
        'event: final\ndata: {"type":"final","result":{"status":"completed"}}',
        "",
        'event: progress\ndata: {"type":"progress"',
      ].join("\n"),
    );

    expect(result.events).toEqual([
      {
        data: '{"type":"progress","message":"Searching"}',
        event: "progress",
      },
      {
        data: '{"type":"final","result":{"status":"completed"}}',
        event: "final",
      },
    ]);
    expect(result.remaining).toBe('event: progress\ndata: {"type":"progress"');
  });

  it("supports crlf-delimited frames", () => {
    const result = parseSseFrames(
      'event: error\r\ndata: {"type":"error","message":"Failed"}\r\n\r\n',
    );

    expect(result).toEqual({
      events: [
        {
          data: '{"type":"error","message":"Failed"}',
          event: "error",
        },
      ],
      remaining: "",
    });
  });
});

