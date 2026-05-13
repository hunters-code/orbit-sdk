#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { createPublisher, OrbitPublishError } from "../publisher.js";
import { createRegistry } from "../registry.js";
import type { Hex } from "viem";

type PackageJson = {
  name?: string;
  version?: string;
  description?: string;
  openclaw?: {
    compat?: { pluginApi?: string; minGatewayVersion?: string };
    build?: { openclawVersion?: string; pluginSdkVersion?: string };
  };
};

type PluginManifest = {
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

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function parseWei(raw: string | number | undefined): bigint {
  if (raw === undefined || String(raw).trim() === "") return 0n;
  try {
    return BigInt(String(raw).trim());
  } catch {
    return 0n;
  }
}

function reportFailure(err: unknown): void {
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

function resolvePluginKey(): Hex {
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

async function main() {
  const cwd = process.cwd();
  const extra = process.argv.slice(2);
  const updateMode = extra.includes("--update");
  const publishArgs = extra.filter((x) => x !== "--update");

  const publisher = createPublisher();
  const registry = createRegistry();

  await publisher.publish({
    cwd,
    extraArgs: publishArgs.length > 0 ? publishArgs : undefined,
  });

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

  if (updateMode) {
    const pluginKey = resolvePluginKey();
    const result = await registry.updatePlugin({
      pluginId: pluginKey,
      slug,
      description,
    });
    console.log(
      JSON.stringify(
        {
          ok: true,
          step: "orbit_updatePlugin",
          pluginKey,
          slug,
          description,
          txHash: result.txHash,
          blockNumber: result.blockNumber.toString(),
        },
        null,
        2,
      ),
    );
  } else {
    const result = await registry.registerPlugin({
      name: displayName,
      version,
      slug,
      description,
      pricePerInstall,
      pricePerUsage,
    });
    console.log(
      JSON.stringify(
        {
          ok: true,
          step: "orbit_registerPlugin",
          pluginId: result.pluginId,
          name: displayName,
          version,
          slug,
          description,
          pricePerInstall: pricePerInstall.toString(),
          pricePerUsage: pricePerUsage.toString(),
          txHash: result.txHash,
          blockNumber: result.blockNumber.toString(),
        },
        null,
        2,
      ),
    );
  }
}

main().catch((err) => {
  reportFailure(err);
  process.exit(1);
});
