import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { OrbitPublishError } from "../src/publisher.js";
import {
  loadPublishCliContext,
  parseWei,
  readJson,
  reportPublishCliFailure,
  resolvePluginKey,
  resolvePluginKeyOptional,
  resolveRegistryPluginId,
} from "../src/bin/cli_common.js";
import type { OrbitRegistryClient } from "../src/types.js";

const validKey = `0x${"e".repeat(64)}`;

describe("parseWei", () => {
  it("returns 0n for undefined, empty string, and whitespace", () => {
    expect(parseWei(undefined)).toBe(0n);
    expect(parseWei("")).toBe(0n);
    expect(parseWei("  ")).toBe(0n);
  });

  it("parses string and number inputs", () => {
    expect(parseWei("42")).toBe(42n);
    expect(parseWei(99)).toBe(99n);
  });

  it("returns 0n on invalid bigint string", () => {
    expect(parseWei("not-a-number")).toBe(0n);
  });
});

describe("resolvePluginKey", () => {
  const prevPlugin = process.env.PLUGIN_KEY;
  const prevOpenclaw = process.env.OPENCLAW_PLUGIN_KEY;
  const prevOrbit = process.env.ORBIT_PLUGIN_ID;

  afterEach(() => {
    if (prevPlugin === undefined) delete process.env.PLUGIN_KEY;
    else process.env.PLUGIN_KEY = prevPlugin;
    if (prevOpenclaw === undefined) delete process.env.OPENCLAW_PLUGIN_KEY;
    else process.env.OPENCLAW_PLUGIN_KEY = prevOpenclaw;
    if (prevOrbit === undefined) delete process.env.ORBIT_PLUGIN_ID;
    else process.env.ORBIT_PLUGIN_ID = prevOrbit;
  });

  it("returns PLUGIN_KEY when set", () => {
    delete process.env.OPENCLAW_PLUGIN_KEY;
    process.env.PLUGIN_KEY = validKey;
    expect(resolvePluginKey()).toBe(validKey);
  });

  it("falls back to OPENCLAW_PLUGIN_KEY", () => {
    delete process.env.PLUGIN_KEY;
    process.env.OPENCLAW_PLUGIN_KEY = validKey;
    expect(resolvePluginKey()).toBe(validKey);
  });

  it("prefers PLUGIN_KEY when both are set", () => {
    const other = `0x${"f".repeat(64)}`;
    process.env.PLUGIN_KEY = validKey;
    process.env.OPENCLAW_PLUGIN_KEY = other;
    expect(resolvePluginKey()).toBe(validKey);
  });

  it("falls back to ORBIT_PLUGIN_ID", () => {
    delete process.env.PLUGIN_KEY;
    delete process.env.OPENCLAW_PLUGIN_KEY;
    process.env.ORBIT_PLUGIN_ID = validKey;
    expect(resolvePluginKey()).toBe(validKey);
  });

  it("throws when missing", () => {
    delete process.env.PLUGIN_KEY;
    delete process.env.OPENCLAW_PLUGIN_KEY;
    expect(() => resolvePluginKey()).toThrow(/Missing PLUGIN_KEY/);
  });

  it("throws when format is invalid", () => {
    process.env.PLUGIN_KEY = "0x1234";
    expect(() => resolvePluginKey()).toThrow(/Invalid PLUGIN_KEY/);
  });
});

describe("resolvePluginKeyOptional", () => {
  const prevPlugin = process.env.PLUGIN_KEY;
  const prevOpenclaw = process.env.OPENCLAW_PLUGIN_KEY;

  afterEach(() => {
    if (prevPlugin === undefined) delete process.env.PLUGIN_KEY;
    else process.env.PLUGIN_KEY = prevPlugin;
    if (prevOpenclaw === undefined) delete process.env.OPENCLAW_PLUGIN_KEY;
    else process.env.OPENCLAW_PLUGIN_KEY = prevOpenclaw;
  });

  it("returns null when unset", () => {
    delete process.env.PLUGIN_KEY;
    delete process.env.OPENCLAW_PLUGIN_KEY;
    expect(resolvePluginKeyOptional()).toBeNull();
  });

  it("returns key when set", () => {
    process.env.PLUGIN_KEY = validKey;
    expect(resolvePluginKeyOptional()).toBe(validKey);
  });
});

describe("resolveRegistryPluginId", () => {
  const prevPlugin = process.env.PLUGIN_KEY;
  const prevOpenclaw = process.env.OPENCLAW_PLUGIN_KEY;
  const owner = "0x1111111111111111111111111111111111111111" as const;

  afterEach(() => {
    if (prevPlugin === undefined) delete process.env.PLUGIN_KEY;
    else process.env.PLUGIN_KEY = prevPlugin;
    if (prevOpenclaw === undefined) delete process.env.OPENCLAW_PLUGIN_KEY;
    else process.env.OPENCLAW_PLUGIN_KEY = prevOpenclaw;
  });

  it("uses PLUGIN_KEY when set", async () => {
    process.env.PLUGIN_KEY = validKey;
    const registry = {
      getSignerAddress: async () => owner,
    } as OrbitRegistryClient;
    const ctx = loadPublishCliContext(
      (() => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-resolve-"));
        fs.writeFileSync(
          path.join(dir, "package.json"),
          JSON.stringify({ name: "p", version: "1.0.0" }),
          "utf8",
        );
        return dir;
      })(),
    );
    const id = await resolveRegistryPluginId(registry, ctx);
    expect(id).toBe(validKey);
  });
});

describe("loadPublishCliContext", () => {
  it("reads package.json and optional manifest", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-cli-"));
    try {
      fs.writeFileSync(
        path.join(dir, "package.json"),
        JSON.stringify({
          name: "pkg-name",
          version: "2.0.0",
          description: "pkg desc",
        }),
        "utf8",
      );
      fs.writeFileSync(
        path.join(dir, "openclaw.plugin.json"),
        JSON.stringify({
          id: "manifest-id",
          name: "Manifest Name",
          slug: "my-slug",
          description: "manifest desc",
          pricePerInstallWei: "10",
          pricePerUsageWei: "5",
        }),
        "utf8",
      );
      const ctx = loadPublishCliContext(dir);
      expect(ctx.pluginId).toBe("manifest-id");
      expect(ctx.displayName).toBe("Manifest Name");
      expect(ctx.version).toBe("2.0.0");
      expect(ctx.slug).toBe("my-slug");
      expect(ctx.description).toBe("manifest desc");
      expect(ctx.pricePerInstall).toBe(10n);
      expect(ctx.pricePerUsage).toBe(5n);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("uses package defaults when manifest is absent", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-cli2-"));
    try {
      fs.writeFileSync(
        path.join(dir, "package.json"),
        JSON.stringify({ name: "only-pkg", version: "1.2.3" }),
        "utf8",
      );
      const ctx = loadPublishCliContext(dir);
      expect(ctx.pluginId).toBe("only-pkg");
      expect(ctx.displayName).toBe("only-pkg");
      expect(ctx.slug).toBe("only-pkg");
      expect(ctx.description).toBe("");
      expect(ctx.pricePerInstall).toBe(0n);
      expect(ctx.pricePerUsage).toBe(0n);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("readJson", () => {
  it("parses JSON file", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-readjson-"));
    try {
      const p = path.join(dir, "x.json");
      fs.writeFileSync(p, '{"a":1}', "utf8");
      expect(readJson<{ a: number }>(p)).toEqual({ a: 1 });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("reportPublishCliFailure", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs OrbitPublishError with exit code", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    reportPublishCliFailure(new OrbitPublishError("dry-run", 3));
    expect(spy.mock.calls.length).toBeGreaterThan(3);
    const joined = spy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(joined).toContain("Dry-run");
    expect(joined).toContain("3");
  });

  it("logs generic Error message", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    reportPublishCliFailure(new Error("boom"));
    const joined = spy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(joined).toContain("boom");
  });

  it("logs non-Error values", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    reportPublishCliFailure(404);
    const joined = spy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(joined).toContain("404");
  });
});
