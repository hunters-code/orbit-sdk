import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseDotEnv, upsertDotEnvKeys } from "../src/runtime_config.js";

describe("parseDotEnv", () => {
  it("parses basic KEY=value pairs", () => {
    expect(parseDotEnv("FOO=bar\nBAZ=qux")).toEqual({ FOO: "bar", BAZ: "qux" });
  });

  it("ignores empty lines and comments", () => {
    expect(
      parseDotEnv(`
# comment
ALPHA=1

BETA=two
`)
    ).toEqual({ ALPHA: "1", BETA: "two" });
  });

  it("strips export prefix", () => {
    expect(parseDotEnv("export PRIVATE_KEY=0xabc")).toEqual({ PRIVATE_KEY: "0xabc" });
  });

  it("unwraps double-quoted values", () => {
    expect(parseDotEnv('X="hello world"')).toEqual({ X: "hello world" });
  });

  it("unwraps single-quoted values", () => {
    expect(parseDotEnv("Y='a=b'")).toEqual({ Y: "a=b" });
  });

  it("last duplicate key wins", () => {
    expect(parseDotEnv("K=1\nK=2")).toEqual({ K: "2" });
  });

  it("skips lines without equals or empty key", () => {
    expect(parseDotEnv("noequals\n=noval\nOK=1")).toEqual({ OK: "1" });
  });
});

describe("upsertDotEnvKeys", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    dirs.length = 0;
  });

  it("creates .env with keys when missing", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-upsert-"));
    dirs.push(dir);
    const pluginId = `0x${"a".repeat(64)}`;
    const envPath = upsertDotEnvKeys(dir, {
      PLUGIN_KEY: pluginId,
      ORBIT_PLUGIN_ID: pluginId,
    });
    expect(envPath).toBe(path.join(dir, ".env"));
    expect(parseDotEnv(fs.readFileSync(envPath, "utf8"))).toEqual({
      PLUGIN_KEY: pluginId,
      ORBIT_PLUGIN_ID: pluginId,
    });
    expect(process.env.PLUGIN_KEY).toBe(pluginId);
  });

  it("updates existing keys and preserves other lines", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-upsert2-"));
    dirs.push(dir);
    const old = `0x${"b".repeat(64)}`;
    const next = `0x${"c".repeat(64)}`;
    fs.writeFileSync(
      path.join(dir, ".env"),
      `# plugin\nPRIVATE_KEY=0x1\nPLUGIN_KEY=${old}\nORBIT_PLUGIN_ID=${old}\n`,
      "utf8",
    );
    upsertDotEnvKeys(dir, { PLUGIN_KEY: next, ORBIT_PLUGIN_ID: next });
    const parsed = parseDotEnv(fs.readFileSync(path.join(dir, ".env"), "utf8"));
    expect(parsed.PRIVATE_KEY).toBe("0x1");
    expect(parsed.PLUGIN_KEY).toBe(next);
    expect(parsed.ORBIT_PLUGIN_ID).toBe(next);
  });
});
