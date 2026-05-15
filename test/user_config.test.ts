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
});
