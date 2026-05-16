#!/usr/bin/env node

import { orbitSdkLog } from "../orbit_log.js";
import { createPublisher } from "../publisher.js";
import { createRegistry } from "../registry.js";
import { persistPluginKeyToEnv } from "../runtime_config.js";
import {
  loadPublishCliContext,
  reportPublishCliFailure,
  resolveRegistryPluginId,
} from "./cli_common.js";

async function main() {
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
