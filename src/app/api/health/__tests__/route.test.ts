import { describe, expect, it } from "vitest";

import { GET } from "../route";

describe("GET /api/health", () => {
  it("returns a successful, non-cacheable health response", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
});
