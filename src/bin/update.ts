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
  const publishArgs = process.argv.slice(2);

  const publisher = createPublisher();
  const registry = createRegistry();

  await publisher.publish({
    cwd,
    extraArgs: publishArgs.length > 0 ? publishArgs : undefined,
  });

  const ctx = loadPublishCliContext(cwd);
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
}

main().catch((err) => {
  reportPublishCliFailure(err);
  process.exit(1);
});
