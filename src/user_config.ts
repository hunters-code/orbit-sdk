import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Hex } from "viem";
import { applyCwdDotEnv, parseDotEnv } from "./runtime_config.js";

let userDotEnvApplied = false;

const USER_ENV_KEYS = new Set(["PRIVATE_KEY"]);

const PLUGIN_SCOPED_ENV_KEYS = new Set([
  "PLUGIN_KEY",
  "ORBIT_PLUGIN_ID",
  "OPENCLAW_PLUGIN_KEY",
  "ORBIT_BILLING_RECORD_INSTALL",
]);

export class OrbitUserNotConfiguredError extends Error {
  constructor(
    message = "Orbit wallet not configured. Run: openclaw orbit wallet setup",
  ) {
    super(message);
    this.name = "OrbitUserNotConfiguredError";
  }
}

export function applyPluginConfigPrivateKey(
  pluginConfig?: Record<string, unknown>,
): void {
  const raw = pluginConfig?.privateKey;
  if (typeof raw !== "string") return;
  const trimmed = raw.trim();
  if (!trimmed) return;
  process.env.PRIVATE_KEY = trimmed;
}

export function resolveUserConfigDir(): string {
  const fromEnv = (process.env.ORBIT_USER_CONFIG_DIR ?? "").trim();
  if (fromEnv) return fromEnv;
  return path.join(os.homedir(), ".orbit");
}

export function resolveUserEnvPath(): string {
  return path.join(resolveUserConfigDir(), ".env");
}

export function resetUserDotEnvCache(): void {
  userDotEnvApplied = false;
}

export function applyUserDotEnv(): void {
  if (userDotEnvApplied) return;
  userDotEnvApplied = true;
  let raw: string;
  try {
    raw = fs.readFileSync(resolveUserEnvPath(), "utf8");
  } catch {
    return;
  }
  const parsed = parseDotEnv(raw);
  for (const [key, val] of Object.entries(parsed)) {
    if (!USER_ENV_KEYS.has(key)) continue;
    process.env[key] = val;
  }
}

export function hasUserPrivateKey(): boolean {
  if (!(process.env.PRIVATE_KEY ?? "").trim()) {
    applyUserDotEnv();
  }
  if (!(process.env.PRIVATE_KEY ?? "").trim()) {
    applyCwdDotEnv();
  }
  const v = (process.env.PRIVATE_KEY ?? "").trim();
  return v.startsWith("0x") && v.length === 66;
}

export function getUserPrivateKey(): Hex {
  if (!(process.env.PRIVATE_KEY ?? "").trim()) {
    applyUserDotEnv();
  }
  if (!(process.env.PRIVATE_KEY ?? "").trim()) {
    applyCwdDotEnv();
  }
  const v = (process.env.PRIVATE_KEY ?? "").trim();
  if (!v) {
    throw new OrbitUserNotConfiguredError();
  }
  if (!v.startsWith("0x") || v.length !== 66) {
    throw new OrbitUserNotConfiguredError(
      "Invalid PRIVATE_KEY in Orbit user config. Run: openclaw orbit wallet setup",
    );
  }
  return v as Hex;
}

export async function ensureOrbitUserReady(): Promise<Hex> {
  return getUserPrivateKey();
}

function formatUserEnvLine(key: string, value: string): string {
  if (/[\s#"']/.test(value)) {
    return `${key}="${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return `${key}=${value}`;
}

export function persistUserPrivateKey(privateKey: string): string {
  const dir = resolveUserConfigDir();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const envPath = resolveUserEnvPath();
  const trimmed = privateKey.trim();
  fs.writeFileSync(envPath, `${formatUserEnvLine("PRIVATE_KEY", trimmed)}\n`, "utf8");
  fs.chmodSync(envPath, 0o600);
  try {
    fs.chmodSync(dir, 0o700);
  } catch {
  }
  for (const key of PLUGIN_SCOPED_ENV_KEYS) {
    delete process.env[key];
  }
  process.env.PRIVATE_KEY = trimmed;
  resetUserDotEnvCache();
  applyUserDotEnv();
  return envPath;
}
