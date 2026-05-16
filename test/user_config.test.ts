import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  OrbitUserNotConfiguredError,
  getUserPrivateKey,
  hasUserPrivateKey,
  persistUserPrivateKey,
  resetUserDotEnvCache,
} from "../src/user_config.js";

const samplePk = `0x${"a".repeat(64)}`;

describe("user_config", () => {
  let configDir: string;
  const prevConfigDir = process.env.ORBIT_USER_CONFIG_DIR;
  const prevPrivateKey = process.env.PRIVATE_KEY;

  afterEach(() => {
    if (configDir) fs.rmSync(configDir, { recursive: true, force: true });
    if (prevConfigDir === undefined) delete process.env.ORBIT_USER_CONFIG_DIR;
    else process.env.ORBIT_USER_CONFIG_DIR = prevConfigDir;
    if (prevPrivateKey === undefined) delete process.env.PRIVATE_KEY;
    else process.env.PRIVATE_KEY = prevPrivateKey;
    resetUserDotEnvCache();
  });

  it("hasUserPrivateKey is false when unset", () => {
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-usercfg-"));
    process.env.ORBIT_USER_CONFIG_DIR = configDir;
    delete process.env.PRIVATE_KEY;
    resetUserDotEnvCache();
    expect(hasUserPrivateKey()).toBe(false);
  });

  it("loads private key from user config file", () => {
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-usercfg2-"));
    process.env.ORBIT_USER_CONFIG_DIR = configDir;
    delete process.env.PRIVATE_KEY;
    persistUserPrivateKey(samplePk);
    resetUserDotEnvCache();
    delete process.env.PRIVATE_KEY;
    expect(hasUserPrivateKey()).toBe(true);
    expect(getUserPrivateKey()).toBe(samplePk);
  });

  it("getUserPrivateKey throws when missing", () => {
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-usercfg3-"));
    process.env.ORBIT_USER_CONFIG_DIR = configDir;
    delete process.env.PRIVATE_KEY;
    resetUserDotEnvCache();
    expect(() => getUserPrivateKey()).toThrow(OrbitUserNotConfiguredError);
  });

  it("applyUserDotEnv loads only PRIVATE_KEY from user config", () => {
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-usercfg4-"));
    process.env.ORBIT_USER_CONFIG_DIR = configDir;
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, ".env"),
      `PRIVATE_KEY=${samplePk}\nORBIT_PLUGIN_ID=0x${"f".repeat(64)}\n`,
      "utf8",
    );
    delete process.env.PRIVATE_KEY;
    delete process.env.ORBIT_PLUGIN_ID;
    resetUserDotEnvCache();
    expect(hasUserPrivateKey()).toBe(true);
    expect(process.env.ORBIT_PLUGIN_ID).toBeUndefined();
  });

  it("persistUserPrivateKey rewrites user env without plugin-scoped keys", () => {
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-usercfg5-"));
    process.env.ORBIT_USER_CONFIG_DIR = configDir;
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, ".env"),
      `PRIVATE_KEY=${samplePk}\nORBIT_PLUGIN_ID=0x${"e".repeat(64)}\n`,
      "utf8",
    );
    persistUserPrivateKey(samplePk);
    const raw = fs.readFileSync(path.join(configDir, ".env"), "utf8");
    expect(raw).toContain("PRIVATE_KEY=");
    expect(raw).not.toContain("ORBIT_PLUGIN_ID");
  });
});
