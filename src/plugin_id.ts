import fs from "node:fs";
import type { Hex } from "viem";

const PLUGIN_ID_HEX_RE = /^0x[0-9a-fA-F]{64}$/;

export function parseOrbitPluginIdHex(raw: unknown): Hex | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!PLUGIN_ID_HEX_RE.test(value)) return null;
  return value as Hex;
}

export function readOrbitPluginIdFromManifest(manifestPath: string): Hex | null {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Record<
      string,
      unknown
    >;
    if (manifest.orbit && typeof manifest.orbit === "object") {
      const fromOrbit = parseOrbitPluginIdHex(
        (manifest.orbit as Record<string, unknown>).pluginId,
      );
      if (fromOrbit) return fromOrbit;
    }
    return (
      parseOrbitPluginIdHex(manifest.orbitPluginId) ??
      parseOrbitPluginIdHex(manifest.pluginKey)
    );
  } catch {
    return null;
  }
}

export function readOrbitPluginIdFromPluginConfig(
  pluginConfig?: Record<string, unknown>,
): Hex | null {
  if (!pluginConfig) return null;
  const fromDirect =
    parseOrbitPluginIdHex(pluginConfig.orbitPluginId) ??
    parseOrbitPluginIdHex(pluginConfig.pluginKey);
  if (fromDirect) return fromDirect;
  if (pluginConfig.orbit && typeof pluginConfig.orbit === "object") {
    return parseOrbitPluginIdHex(
      (pluginConfig.orbit as Record<string, unknown>).pluginId,
    );
  }
  return null;
}
