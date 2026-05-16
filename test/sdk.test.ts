import { describe, it, expect, afterEach } from "vitest";
import { createOrbitSdk } from "../src/sdk.js";
import type { CreateOrbitSdkConfig } from "../src/types.js";

const samplePk = `0x${"c".repeat(64)}`;

describe("createOrbitSdk", () => {
  const prev = process.env.PRIVATE_KEY;

  afterEach(() => {
    if (prev === undefined) delete process.env.PRIVATE_KEY;
    else process.env.PRIVATE_KEY = prev;
  });

  it("returns registry, billing, storage, publisher with explicit privateKey", () => {
    const sdk = createOrbitSdk({ privateKey: samplePk as `0x${string}` });
    expect(sdk.registry).toBeDefined();
    expect(sdk.billing).toBeDefined();
    expect(sdk.storage).toBeDefined();
    expect(sdk.publisher).toBeDefined();
    expect(typeof sdk.registry.registerPlugin).toBe("function");
    expect(typeof sdk.billing.recordInstall).toBe("function");
  });

  it("reads PRIVATE_KEY from env when privateKey is omitted", () => {
    process.env.PRIVATE_KEY = samplePk;
    const sdk = createOrbitSdk({} as CreateOrbitSdkConfig);
    expect(sdk.registry).toBeDefined();
    expect(sdk.billing).toBeDefined();
  });

  it("throws when privateKey and PRIVATE_KEY are missing on property access", () => {
    delete process.env.PRIVATE_KEY;
    const sdk = createOrbitSdk({} as CreateOrbitSdkConfig);
    expect(() => sdk.registry).toThrow(/Missing PRIVATE_KEY/);
    expect(() => sdk.billing).toThrow(/Missing PRIVATE_KEY/);
  });

  it("returns lazy registry and billing when config is nullish", () => {
    const sdk = createOrbitSdk(null as unknown as CreateOrbitSdkConfig);
    expect(sdk.registry).toBeDefined();
    expect(sdk.billing).toBeDefined();
    expect(typeof sdk.registry.registerPlugin).toBe("function");
  });
});
