#!/usr/bin/env node

import { orbitSdkLog } from "../orbit_log.js";
import { createPublisher } from "../publisher.js";
import { createRegistry } from "../registry.js";
import { persistPluginKeyToEnv, persistPluginKeyToManifest } from "../runtime_config.js";
import {
  loadPublishCliContext,
  reportPublishCliFailure,
  resolveRegistryPluginId,
} from "./cli_common.js";

async function main() {
  // Prevent orbit-publish from running during `openclaw plugins install` or
  // any npm lifecycle hook (publish, preinstall, postinstall, etc.).
  // npm sets npm_lifecycle_event to the script name being executed.
  const lifecycleEvent = process.env.npm_lifecycle_event ?? "";
  const lifecycleScript = process.env.npm_lifecycle_script ?? "";
  const isNpmLifecycle = Boolean(lifecycleEvent && lifecycleEvent !== "orbit:publish");
  const isOpenClawInstall = Boolean(
    process.env.OPENCLAW_INSTALLING ??
    process.env.OPENCLAW_INSTALL_CONTEXT,
  );
  if (isNpmLifecycle || isOpenClawInstall) {
    console.error(
      `[orbit-publish] Skipped: detected npm lifecycle event "${lifecycleEvent}" (script: "${lifecycleScript}"). ` +
      `Run "npm run orbit:publish" explicitly to publish and register.`,
    );
    process.exit(0);
  }

  const cwd = process.cwd();
  const publishArgs = process.argv.slice(2);
  const publisher = createPublisher();
  const registry = createRegistry();

  orbitSdkLog("info", "publish.orbit-publish.start", {
    note: "This CLI is for creators only; openclaw plugins install never runs this.",
    cwd,
  });

  await publisher.publish({
    cwd,
    extraArgs: publishArgs.length > 0 ? publishArgs : undefined,
  });

  orbitSdkLog("info", "publish.clawhub.done", {
    note: "ClawHub package publish finished; next step is on-chain registry only if orbit-publish continues.",
  });

  const ctx = loadPublishCliContext(cwd);
  const pluginId = await resolveRegistryPluginId(registry, ctx);
  const registered = await registry.isRegistered(pluginId);

  orbitSdkLog("info", "publish.registry.probe", {
    pluginId,
    registered: String(registered),
    note: registered ? "Will call updatePlugin on OrbitRegistry" : "Will call registerPlugin on OrbitRegistry",
  });

  if (registered) {
    const result = await registry.updatePlugin({
      pluginId,
      slug: ctx.slug,
      description: ctx.description,
    });
    const envPath = persistPluginKeyToEnv(cwd, pluginId);
    persistPluginKeyToManifest(cwd, pluginId);
    console.log(
      JSON.stringify(
        {
          ok: true,
          published: true,
          step: "orbit_updatePlugin",
          pluginId,
          envPath,
          slug: ctx.slug,
          description: ctx.description,
          txHash: result.txHash,
          blockNumber: result.blockNumber.toString(),
        },
        null,
        2,
      ),
    );
    return;
  }

  const result = await registry.registerPlugin({
    name: ctx.displayName,
    version: ctx.version,
    slug: ctx.slug,
    description: ctx.description,
    pricePerInstall: ctx.pricePerInstall,
    pricePerUsage: ctx.pricePerUsage,
  });
  const envPath = persistPluginKeyToEnv(cwd, result.pluginId);
  persistPluginKeyToManifest(cwd, result.pluginId);
  console.log(
    JSON.stringify(
      {
        ok: true,
        published: true,
        step: "orbit_registerPlugin",
        pluginId: result.pluginId,
        envPath,
        name: ctx.displayName,
        version: ctx.version,
        slug: ctx.slug,
        description: ctx.description,
        pricePerInstall: ctx.pricePerInstall.toString(),
        pricePerUsage: ctx.pricePerUsage.toString(),
        txHash: result.txHash,
        blockNumber: result.blockNumber.toString(),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  reportPublishCliFailure(err);
  process.exit(1);
});
