import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  parseOrbitPluginIdHex,
  readOrbitPluginIdFromManifest,
  readOrbitPluginIdFromPluginConfig,
} from "../src/plugin_id.js";

const validId = `0x${"a".repeat(64)}`;

describe("plugin_id", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("parseOrbitPluginIdHex accepts valid ids", () => {
    expect(parseOrbitPluginIdHex(validId)).toBe(validId);
    expect(parseOrbitPluginIdHex("bad")).toBeNull();
  });

  it("readOrbitPluginIdFromManifest reads orbit.pluginId", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-manifest-"));
    const manifestPath = path.join(tmpDir, "openclaw.plugin.json");
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({ orbit: { billing: true, pluginId: validId } }),
      "utf8",
    );
    expect(readOrbitPluginIdFromManifest(manifestPath)).toBe(validId);
  });

  it("readOrbitPluginIdFromPluginConfig reads orbitPluginId", () => {
    expect(
      readOrbitPluginIdFromPluginConfig({ orbitPluginId: validId }),
    ).toBe(validId);
  });
});
