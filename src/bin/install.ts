#!/usr/bin/env node

import { runOrbitUserWalletSetup } from "../user_wallet_setup.js";
import { resolveUserEnvPath } from "../user_config.js";
import { paint, S } from "./cli_common.js";

async function main() {
  const envPath = await runOrbitUserWalletSetup();
  console.log("");
  console.log(`${paint("✔", S.green + S.bold)} Wallet configured`);
  console.log(`  ${paint("Config:", S.dim)} ${envPath || resolveUserEnvPath()}`);
  console.log(
    paint("  Install plugins with: openclaw plugins install clawhub:<plugin>", S.dim),
  );
  console.log("");
}

main().catch((err) => {
  if (err instanceof Error) {
    console.error(`${paint("✖", S.red + S.bold)} ${err.message}`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
