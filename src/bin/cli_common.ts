import fs from "node:fs";
import path from "node:path";
import type { Hex } from "viem";
import { OrbitPublishError } from "../publisher.js";

export type PackageJson = {
  name?: string;
  version?: string;
  description?: string;
  openclaw?: {
    compat?: { pluginApi?: string; minGatewayVersion?: string };
    build?: { openclawVersion?: string; pluginSdkVersion?: string };
  };
};

export type PluginManifest = {
  id?: string;
  name?: string;
  description?: string;
  slug?: string;
  priceWei?: string | number;
  pricePerInstallWei?: string | number;
  pricePerUsageWei?: string | number;
};

const colorEnabled =
  Boolean(process.stderr.isTTY) &&
  !process.env.NO_COLOR &&
  process.env.FORCE_COLOR !== "0";

const S = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

function paint(text: string, open: string): string {
  if (!colorEnabled) return text;
  return `${open}${text}${S.reset}`;
}

export function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

export function parseWei(raw: string | number | undefined): bigint {
  if (raw === undefined || String(raw).trim() === "") return 0n;
  try {
    return BigInt(String(raw).trim());
  } catch {
    return 0n;
  }
}

export function reportPublishCliFailure(err: unknown): void {
  const line = paint("─".repeat(56), S.dim);
  console.error("");
  console.error(line);

  if (err instanceof OrbitPublishError) {
    const phaseLabel =
      err.phase === "dry-run"
        ? paint("Dry-run", S.cyan + S.bold)
        : paint("Publish", S.cyan + S.bold);
    console.error(`${paint("✖", S.red + S.bold)} ${phaseLabel} ${paint("step failed", S.bold)}`);
    if (err.exitCode != null) {
      console.error(`  ${paint("Exit code:", S.dim)} ${paint(String(err.exitCode), S.yellow)}`);
    }
  } else if (err instanceof Error) {
    console.error(`${paint("✖", S.red + S.bold)} ${paint(err.message, S.bold)}`);
  } else {
    console.error(`${paint("✖", S.red + S.bold)} ${paint(String(err), S.bold)}`);
  }

  console.error("");
  console.error(paint("Typical fixes:", S.yellow + S.bold));
  console.error(`  ${paint("•", S.dim)} ${paint("clawhub login", S.green)} ${paint("(interactive)", S.dim)}`);
  console.error(
    `  ${paint("•", S.dim)} ${paint("OPENCLAW_CLAWHUB_TOKEN", S.green)} ${paint("or", S.dim)} ${paint("CLAWHUB_TOKEN", S.green)} ${paint("in env", S.dim)}`,
  );
  console.error(`  ${paint("•", S.dim)} ${paint("clawhub login --token", S.green)} ${paint("<token>", S.dim)}`);
  console.error(line);
  console.error("");
}

export function resolvePluginKey(): Hex {
  const v = (
    process.env.PLUGIN_KEY ??
    process.env.OPENCLAW_PLUGIN_KEY ??
    ""
  ).trim();
  if (!v) throw new Error("Missing PLUGIN_KEY for plugin update");
  if (!v.startsWith("0x") || v.length !== 66) {
    throw new Error("Invalid PLUGIN_KEY (expected 0x + 64 hex chars)");
  }
  return v as Hex;
}

export type PublishCliContext = {
  pkg: PackageJson;
  manifest: PluginManifest;
  pluginId: string;
  displayName: string;
  version: string;
  slug: string;
  description: string;
  pricePerInstall: bigint;
  pricePerUsage: bigint;
};

export function loadPublishCliContext(cwd: string): PublishCliContext {
  const pkg = readJson<PackageJson>(path.join(cwd, "package.json"));

  const manifestPath = path.join(cwd, "openclaw.plugin.json");
  const manifest: PluginManifest = fs.existsSync(manifestPath)
    ? readJson<PluginManifest>(manifestPath)
    : {};

  const pluginId = manifest.id ?? pkg.name ?? "unknown-plugin";
  const displayName = manifest.name ?? pkg.name ?? pluginId;
  const version = pkg.version ?? "0.0.0";
  const slug = (manifest.slug ?? pluginId).trim();
  const description = (manifest.description ?? pkg.description ?? "").trim();

  const pricePerInstall = parseWei(
    manifest.pricePerInstallWei ?? manifest.priceWei,
  );
  const pricePerUsage = parseWei(manifest.pricePerUsageWei);

  return {
    pkg,
    manifest,
    pluginId,
    displayName,
    version,
    slug,
    description,
    pricePerInstall,
    pricePerUsage,
  };
}
