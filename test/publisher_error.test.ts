import { describe, it, expect } from "vitest";
import { OrbitPublishError } from "../src/publisher.js";

describe("OrbitPublishError", () => {
  it("sets phase and exitCode for dry-run", () => {
    const err = new OrbitPublishError("dry-run", 2);
    expect(err.phase).toBe("dry-run");
    expect(err.exitCode).toBe(2);
    expect(err.message).toContain("dry-run");
    expect(err.message).toContain("2");
  });

  it("sets phase for publish", () => {
    const err = new OrbitPublishError("publish", null);
    expect(err.phase).toBe("publish");
    expect(err.exitCode).toBe(null);
    expect(err.message).toContain("publish");
  });
});
