import fs from "node:fs";
import path from "node:path";
import { input, password } from "@inquirer/prompts";

let cwdDotEnvApplied = false;

export function parseDotEnv(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    let key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (key.startsWith("export ")) {
      key = key.slice(7).trim();
    }
    if (!key) continue;
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

export function resetCwdDotEnvCache(): void {
  cwdDotEnvApplied = false;
}

function formatDotEnvValue(value: string): string {
  if (/[\s#"']/.test(value)) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return value;
}

function parseDotEnvLineKey(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const eq = trimmed.indexOf("=");
  if (eq <= 0) return null;
  let key = trimmed.slice(0, eq).trim();
  if (key.startsWith("export ")) key = key.slice(7).trim();
  return key || null;
}

export function upsertDotEnvKeys(cwd: string, entries: Record<string, string>): string {
  const envPath = path.join(cwd, ".env");
  const lines = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, "utf8").split(/\n/)
    : [];

  for (const [key, value] of Object.entries(entries)) {
    process.env[key] = value;
    const formatted = `${key}=${formatDotEnvValue(value)}`;
    let found = false;
    for (let i = 0; i < lines.length; i++) {
      if (parseDotEnvLineKey(lines[i]) === key) {
        lines[i] = formatted;
        found = true;
        break;
      }
    }
    if (!found) {
      if (lines.length > 0 && lines[lines.length - 1] !== "") lines.push("");
      lines.push(formatted);
    }
  }

  const content = lines.length > 0 ? `${lines.join("\n")}\n` : "";
  fs.writeFileSync(envPath, content, "utf8");
  return envPath;
}

export function persistPluginKeyToEnv(cwd: string, pluginId: string): string {
  return upsertDotEnvKeys(cwd, {
    PLUGIN_KEY: pluginId,
    ORBIT_PLUGIN_ID: pluginId,
  });
}

function applyCwdDotEnv(): void {
  if (cwdDotEnvApplied) return;
  cwdDotEnvApplied = true;
  const envPath = path.join(process.cwd(), ".env");
  let raw: string;
  try {
    raw = fs.readFileSync(envPath, "utf8");
  } catch {
    return;
  }
  const parsed = parseDotEnv(raw);
  for (const [key, val] of Object.entries(parsed)) {
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

function hasTty(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export async function getEnvOrPrompt(params: {
  envKey: string;
  promptMessage: string;
  secret?: boolean;
  validate?: (value: string) => true | string;
}): Promise<string> {
  applyCwdDotEnv();
  const fromEnv = (process.env[params.envKey] ?? "").trim();
  if (fromEnv) return fromEnv;

  if (!hasTty()) {
    throw new Error(`Missing ${params.envKey} and terminal is not interactive`);
  }

  const ask = params.secret ? password : input;
  const value = (await ask({
    message: `${params.promptMessage} (${params.envKey})`,
    validate: (raw: string) => {
      const v = raw.trim();
      if (!v) return `${params.envKey} is required`;
      if (params.validate) return params.validate(v);
      return true;
    }
  })) as string;

  process.env[params.envKey] = value.trim();
  return value.trim();
}

export async function getAnyEnvOrPrompt(params: {
  envKeys: string[];
  promptMessage: string;
  secret?: boolean;
  validate?: (value: string) => true | string;
}): Promise<string> {
  applyCwdDotEnv();
  for (const envKey of params.envKeys) {
    const value = (process.env[envKey] ?? "").trim();
    if (value) return value;
  }
  return getEnvOrPrompt({
    envKey: params.envKeys[0],
    promptMessage: params.promptMessage,
    secret: params.secret,
    validate: params.validate
  });
}
