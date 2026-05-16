#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { input } from "@inquirer/prompts";

const cwd = process.cwd();

async function prompt(message: string, defaultValue?: string): Promise<string> {
  const value = await input({ message, default: defaultValue });
  return value.trim();
}

function writeIfMissing(filePath: string, content: string): void {
  if (fs.existsSync(filePath)) {
    console.log(`  skip  ${path.relative(cwd, filePath)} (already exists)`);
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
  console.log(`  create  ${path.relative(cwd, filePath)}`);
}

async function main() {
  console.log("\n  Orbit Plugin Init\n");

  const dirName = path.basename(cwd);

  const pluginId = await prompt("Plugin ID (kebab-case):", dirName);
  const pluginName = await prompt("Plugin display name:", pluginId);
  const description = await prompt("Description:", "An Orbit plugin");
  const author = await prompt("Author:", "");
  const version = await prompt("Version:", "0.1.0");

  console.log("");

  const packageJson = {
    name: pluginId,
    version,
    description,
    type: "module",
    main: "index.ts",
    keywords: ["openclaw", "plugin", "orbit"],
    ...(author ? { author } : {}),
    license: "MIT",
    dependencies: {
      "@orbit-0g/sdk": "latest",
      "@sinclair/typebox": "latest",
    },
    devDependencies: {
      "@types/node": "latest",
      openclaw: "latest",
      typescript: "latest",
    },
    peerDependencies: {
      openclaw: ">=2026.2.0",
    },
    scripts: {
      typecheck: "tsc --noEmit",
      publish: "orbit-publish",
    },
    openclaw: {
      extensions: ["./index.ts"],
      compat: {
        pluginApi: ">=2026.3.24-beta.2",
        minGatewayVersion: "2026.3.24-beta.2",
      },
      build: {
        openclawVersion: "2026.3.24-beta.2",
        pluginSdkVersion: "2026.3.24-beta.2",
      },
    },
  };

  const openclawPluginJson = {
    id: pluginId,
    name: pluginName,
    description,
    orbit: { billing: true },
    activation: { onStartup: true },
    configSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        privateKey: {
          type: "string",
          description: "Wallet private key for Orbit billing (0x + 64 hex chars)",
        },
      },
    },
  };

  const tsconfigJson = {
    compilerOptions: {
      target: "ES2022",
      lib: ["ES2022"],
      module: "ESNext",
      moduleResolution: "Bundler",
      strict: true,
      skipLibCheck: true,
      noEmit: true,
      types: ["node"],
    },
    include: ["*.ts", "src/**/*.ts"],
    exclude: ["node_modules"],
  };

  const tsconfigBuildJson = {
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "Bundler",
      strict: true,
      skipLibCheck: true,
      outDir: "dist",
      rootDir: ".",
      declaration: false,
      sourceMap: false,
      noEmit: false,
    },
    include: ["index.ts", "src/**/*.ts"],
  };

  const indexTs = `import { Type, type Static } from "@sinclair/typebox";
import {
  createOrbitSdk,
  ensureOrbitWalletForOpenClaw,
  orbitSdkLog,
  registerOrbitUserBilling,
  type OrbitSdk,
} from "@orbit-0g/sdk";
import { definePluginEntry, jsonResult } from "openclaw/plugin-sdk/core";

const orbitPluginIdRaw = (process.env.ORBIT_PLUGIN_ID ?? "").trim();
const orbitPluginId = orbitPluginIdRaw ? (orbitPluginIdRaw as \`0x\${string}\`) : null;
let orbitSdk: OrbitSdk | null = null;
let orbitInstallRecorded = false;

function getOrbitSdk(): OrbitSdk {
  if (!orbitSdk) {
    orbitSdk = createOrbitSdk();
  }
  return orbitSdk;
}

async function chargeOrbitForTool(
  toolName: string,
  pluginConfig?: Record<string, unknown>,
  logger?: { info?: (msg: string) => void; warn?: (msg: string) => void; error?: (msg: string) => void },
) {
  if (!orbitPluginId) {
    orbitSdkLog("warn", "plugin.billing.skip", { reason: "ORBIT_PLUGIN_ID unset" }, logger);
    return;
  }
  await ensureOrbitWalletForOpenClaw({ pluginConfig, logger });
  orbitSdkLog("info", "plugin.billing.charge.start", { toolName, orbitPluginId }, logger);
  const sdk = getOrbitSdk();
  if (!orbitInstallRecorded && process.env.ORBIT_BILLING_RECORD_INSTALL === "1") {
    await sdk.billing.recordInstall(orbitPluginId);
    orbitInstallRecorded = true;
  }
  await sdk.billing.recordUsage(orbitPluginId, toolName);
  orbitSdkLog("info", "plugin.billing.charge.done", { toolName, orbitPluginId }, logger);
}

const helloParams = Type.Object({
  name: Type.String({ description: "Name to greet" }),
});

export default definePluginEntry({
  id: ${JSON.stringify(pluginId)},
  name: ${JSON.stringify(pluginName)},
  description: ${JSON.stringify(description)},
  register(api) {
    registerOrbitUserBilling(api);
    api.registerTool({
      name: "${pluginId.replace(/-/g, "_")}_hello",
      label: "Hello",
      description: "A sample tool that greets the user",
      parameters: helloParams,
      async execute(_id, params) {
        const p = params as Static<typeof helloParams>;
        await chargeOrbitForTool("${pluginId.replace(/-/g, "_")}_hello", api.pluginConfig, api.logger);
        return jsonResult({ ok: true, message: \`Hello, \${p.name}!\` });
      },
    });
  },
});
`;

  const envExample = `ORBIT_RPC_URL=https://evmrpc-testnet.0g.ai
ORBIT_CHAIN_ID=
ORBIT_CHAIN_NAME=
PRIVATE_KEY=
ORBIT_REGISTRY_ADDRESS=
ORBIT_BILLING_ADDRESS=
PLUGIN_KEY=
ORBIT_PLUGIN_ID=
ORBIT_BILLING_RECORD_INSTALL=0
`;

  const gitignore = `node_modules/
dist/
.env
`;

  writeIfMissing(path.join(cwd, "package.json"), JSON.stringify(packageJson, null, 2) + "\n");
  writeIfMissing(path.join(cwd, "openclaw.plugin.json"), JSON.stringify(openclawPluginJson, null, 2) + "\n");
  writeIfMissing(path.join(cwd, "tsconfig.json"), JSON.stringify(tsconfigJson, null, 2) + "\n");
  writeIfMissing(path.join(cwd, "tsconfig.build.json"), JSON.stringify(tsconfigBuildJson, null, 2) + "\n");
  writeIfMissing(path.join(cwd, "index.ts"), indexTs);
  writeIfMissing(path.join(cwd, ".env.example"), envExample);
  writeIfMissing(path.join(cwd, ".gitignore"), gitignore);

  console.log(`
  Done! Next steps:

    npm install
    # edit .env with your credentials
    # edit index.ts to add your tools
    npm run publish
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
