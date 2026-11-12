import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createLoginLimiter, MAX_PER_KEY, MAX_GLOBAL, WINDOW_MS } from "./login-limiter.js";

describe("login limiter", () => {
  it("blocks a key after MAX_PER_KEY failures and releases it after the window", () => {
    let t = 1_000_000;
    const l = createLoginLimiter(() => t);
    for (let i = 0; i < MAX_PER_KEY; i++) {
      assert.equal(l.retryAfter("ip1"), 0);
      l.recordFailure("ip1");
    }
    assert.ok(l.retryAfter("ip1") > 0);
    assert.equal(l.retryAfter("ip2"), 0, "other keys are unaffected");
    t += WINDOW_MS + 1;
    assert.equal(l.retryAfter("ip1"), 0);
  });

  it("a successful login clears the key's failures", () => {
    const l = createLoginLimiter();
    for (let i = 0; i < MAX_PER_KEY - 1; i++) l.recordFailure("ip");
    l.recordSuccess("ip");
    l.recordFailure("ip");
    assert.equal(l.retryAfter("ip"), 0);
  });

  it("blocks everyone once global failures pass MAX_GLOBAL (rotating IPs)", () => {
    const l = createLoginLimiter();
    for (let i = 0; i < MAX_GLOBAL; i++) l.recordFailure(`ip-${i}`);
    assert.ok(l.retryAfter("brand-new-ip") > 0);
  });
});
