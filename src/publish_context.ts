import fs from "node:fs";
import path from "node:path";

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
