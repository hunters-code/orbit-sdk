#!/usr/bin/env node

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

  await publisher.publish({
    cwd,
    extraArgs: publishArgs.length > 0 ? publishArgs : undefined,
  });

  const ctx = loadPublishCliContext(cwd);
  const pluginId = await resolveRegistryPluginId(registry, ctx);
  const registered = await registry.isRegistered(pluginId);

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
