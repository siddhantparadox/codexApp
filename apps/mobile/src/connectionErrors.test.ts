import { describe, expect, it } from "vitest";
import { isThreadUnavailableError } from "./connectionErrors";

describe("isThreadUnavailableError", () => {
  it("matches rollout path errors", () => {
    expect(isThreadUnavailableError("state db missing rollout path for thread 123")).toBe(true);
  });

  it("matches missing thread errors", () => {
    expect(isThreadUnavailableError("thread abc not found")).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isThreadUnavailableError("network timeout while connecting")).toBe(false);
  });
});

