import { describe, expect, it } from "vitest";

import {
  buildToolProgressMessage,
  shouldShowModelProgressText,
} from "../agent-progress";

describe("shouldShowModelProgressText", () => {
  it("shows normal prose", () => {
    expect(shouldShowModelProgressText("Sure, I can help with that.")).toBe(true);
    expect(shouldShowModelProgressText("Done, I fixed it.")).toBe(true);
  });

  it("hides machine protocol text", () => {
    expect(
      shouldShowModelProgressText(
        '{"status":"completed","message":"Updated the button state."}',
      ),
    ).toBe(false);
    expect(
      shouldShowModelProgressText(
        '{"tool_calls":[{"function":{"name":"read_file","arguments":"{}"}}]}',
      ),
    ).toBe(false);
    expect(
      shouldShowModelProgressText(
        '<tool_call>{"name":"read_file","arguments":{"path":"src/a.ts"}}</tool_call>',
      ),
    ).toBe(false);
  });
});

describe("buildToolProgressMessage", () => {
  it("maps tool calls to high-level progress copy", () => {
    expect(buildToolProgressMessage("glob_files", { path: "src" })).toBe(
      "Finding files in src...",
    );
    expect(buildToolProgressMessage("search_code", { query: "Button" })).toBe(
      "Searching the codebase...",
    );
    expect(buildToolProgressMessage("list_directory", { path: "src" })).toBe(
      "Inspecting src...",
    );
    expect(buildToolProgressMessage("read_file", { path: "src/Button.tsx" })).toBe(
      "Reading src/Button.tsx...",
    );
    expect(
      buildToolProgressMessage("replace_in_file", { path: "src/Button.tsx" }),
    ).toBe("Editing src/Button.tsx...");
    expect(buildToolProgressMessage("write_file", {})).toBe("Editing a file...");
  });
});
