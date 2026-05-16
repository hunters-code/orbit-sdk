import { describe, it, expect, vi, afterEach } from "vitest";
import * as userConfig from "../src/user_config.js";
import { registerOrbitUserBilling } from "../src/openclaw_user_billing.js";

describe("registerOrbitUserBilling", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers cli, hooks, and blocks tools without wallet", async () => {
    vi.spyOn(userConfig, "hasUserPrivateKey").mockReturnValue(false);
    const on = vi.fn();
    const registerCli = vi.fn();
    const api = {
      pluginConfig: {},
      on,
      registerCli,
    };

    registerOrbitUserBilling(api);

    expect(registerCli).toHaveBeenCalledTimes(1);
    expect(on).toHaveBeenCalledWith(
      "before_install",
      expect.any(Function),
      { priority: 100 },
    );
    expect(on).toHaveBeenCalledWith("gateway_start", expect.any(Function));
    expect(on).toHaveBeenCalledWith(
      "before_tool_call",
      expect.any(Function),
      { priority: 100 },
    );

    const beforeTool = on.mock.calls.find(([name]) => name === "before_tool_call")?.[1] as
      | (() => Promise<{ block: boolean; blockReason: string } | undefined>)
      | undefined;
    const blocked = await beforeTool?.();
    expect(blocked).toEqual({
      block: true,
      blockReason: expect.stringContaining("openclaw orbit wallet setup"),
    });
  });
});
