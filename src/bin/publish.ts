#!/usr/bin/env node

import { createPublisher } from "../publisher.js";
import { createRegistry } from "../registry.js";
import {
  loadPublishCliContext,
  reportPublishCliFailure,
  resolvePluginKey,
} from "./cli_common.js";

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

  const ctx = loadPublishCliContext(cwd);

  if (updateMode) {
    const pluginKey = resolvePluginKey();
    const result = await registry.updatePlugin({
      pluginId: pluginKey,
      slug: ctx.slug,
      description: ctx.description,
    });
    console.log(
      JSON.stringify(
        {
          ok: true,
          step: "orbit_updatePlugin",
          pluginKey,
          slug: ctx.slug,
          description: ctx.description,
          txHash: result.txHash,
          blockNumber: result.blockNumber.toString(),
        },
        null,
        2,
      ),
    );
  } else {
    const result = await registry.registerPlugin({
      name: ctx.displayName,
      version: ctx.version,
      slug: ctx.slug,
      description: ctx.description,
      pricePerInstall: ctx.pricePerInstall,
      pricePerUsage: ctx.pricePerUsage,
    });
    console.log(
      JSON.stringify(
        {
          ok: true,
          step: "orbit_registerPlugin",
          pluginId: result.pluginId,
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
}

main().catch((err) => {
  reportPublishCliFailure(err);
  process.exit(1);
});
