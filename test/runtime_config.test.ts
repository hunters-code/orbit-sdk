import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

vi.mock("@inquirer/prompts", () => ({
  input: vi.fn(),
  password: vi.fn()
}));

import { input, password } from "@inquirer/prompts";
import {
  getEnvOrPrompt,
  getAnyEnvOrPrompt,
  resetCwdDotEnvCache
} from "../src/runtime_config.js";

const samplePk = `0x${"a".repeat(64)}` as const;

describe("getEnvOrPrompt", () => {
  const prevPrivateKey = process.env.PRIVATE_KEY;
  const prevIn = process.stdin.isTTY;
  const prevOut = process.stdout.isTTY;

  beforeEach(() => {
    vi.mocked(input).mockReset();
    vi.mocked(password).mockReset();
    delete process.env.PRIVATE_KEY;
    resetCwdDotEnvCache();
  });

  afterEach(() => {
    if (prevPrivateKey === undefined) delete process.env.PRIVATE_KEY;
    else process.env.PRIVATE_KEY = prevPrivateKey;
    Object.defineProperty(process.stdin, "isTTY", { value: prevIn, configurable: true });
    Object.defineProperty(process.stdout, "isTTY", { value: prevOut, configurable: true });
    resetCwdDotEnvCache();
  });

  it("returns trimmed value from process.env without prompting", async () => {
    process.env.PRIVATE_KEY = `  ${samplePk}  `;
    const v = await getEnvOrPrompt({
      envKey: "PRIVATE_KEY",
      promptMessage: "key"
    });
    expect(v).toBe(samplePk);
    expect(password).not.toHaveBeenCalled();
    expect(input).not.toHaveBeenCalled();
  });

  it("loads PRIVATE_KEY from cwd .env when unset in process.env", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-sdk-env-"));
    const prevCwd = process.cwd();
    process.chdir(dir);
    try {
      fs.writeFileSync(path.join(dir, ".env"), `PRIVATE_KEY=${samplePk}\n`, "utf8");
      const v = await getEnvOrPrompt({
        envKey: "PRIVATE_KEY",
        promptMessage: "key"
      });
      expect(v).toBe(samplePk);
      expect(password).not.toHaveBeenCalled();
    } finally {
      process.chdir(prevCwd);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not overwrite an existing process.env with .env file", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-sdk-env2-"));
    const prevCwd = process.cwd();
    const other = `0x${"b".repeat(64)}`;
    process.env.PRIVATE_KEY = other;
    process.chdir(dir);
    try {
      fs.writeFileSync(path.join(dir, ".env"), `PRIVATE_KEY=${samplePk}\n`, "utf8");
      resetCwdDotEnvCache();
      const v = await getEnvOrPrompt({
        envKey: "PRIVATE_KEY",
        promptMessage: "key"
      });
      expect(v).toBe(other);
    } finally {
      process.chdir(prevCwd);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws when missing, non-interactive, and no .env value", async () => {
    Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
    Object.defineProperty(process.stdout, "isTTY", { value: false, configurable: true });
    await expect(
      getEnvOrPrompt({ envKey: "PRIVATE_KEY", promptMessage: "key" })
    ).rejects.toThrow(/Missing PRIVATE_KEY/);
  });

  it("prompts with password when interactive and missing", async () => {
    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
    vi.mocked(password).mockResolvedValue(samplePk);
    const v = await getEnvOrPrompt({
      envKey: "PRIVATE_KEY",
      promptMessage: "Enter key",
      secret: true,
      validate: (value) =>
        value.startsWith("0x") && value.length === 66 ? true : "bad"
    });
    expect(v).toBe(samplePk);
    expect(password).toHaveBeenCalled();
  });
});

describe("getAnyEnvOrPrompt", () => {
  const keys = ["ORBIT_ALT", "PRIVATE_KEY"] as const;
  const prev: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of keys) {
      prev[k] = process.env[k];
      delete process.env[k];
    }
    vi.mocked(input).mockReset();
    vi.mocked(password).mockReset();
    resetCwdDotEnvCache();
  });

  afterEach(() => {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
    resetCwdDotEnvCache();
  });

  it("returns first defined env key", async () => {
    process.env.ORBIT_ALT = "first";
    process.env.PRIVATE_KEY = samplePk;
    const v = await getAnyEnvOrPrompt({
      envKeys: ["ORBIT_ALT", "PRIVATE_KEY"],
      promptMessage: "x"
    });
    expect(v).toBe("first");
  });

  it("falls back to second key", async () => {
    process.env.PRIVATE_KEY = samplePk;
    const v = await getAnyEnvOrPrompt({
      envKeys: ["ORBIT_ALT", "PRIVATE_KEY"],
      promptMessage: "x"
    });
    expect(v).toBe(samplePk);
  });
});
