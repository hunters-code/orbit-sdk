#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { input } from "@inquirer/prompts";
import { parseDotEnv } from "../runtime_config.js";

const cwd = process.cwd();

const OBSOLETE_ENV_KEYS = new Set([
  "ORBIT_REGISTRY_ADDRESS",
  "ORBIT_BILLING_ADDRESS",
  "ORBIT_CHAIN_ID",
  "ORBIT_CHAIN_NAME",
  "ORBIT_RPC_URL",
]);

const ENV_EXAMPLE_DEFAULTS: Record<string, string> = {
  PRIVATE_KEY: "",
  PLUGIN_KEY: "",
  ORBIT_PLUGIN_ID: "",
  ORBIT_BILLING_RECORD_INSTALL: "0",
};

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

function writeJson(
  filePath: string,
  value: unknown,
  action: "create" | "update" | "ok",
): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const content = JSON.stringify(value, null, 2) + "\n";
  if (action === "create") {
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`  create  ${path.relative(cwd, filePath)}`);
    return;
  }
  if (action === "update") {
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`  update  ${path.relative(cwd, filePath)}`);
    return;
  }
  console.log(`  ok  ${path.relative(cwd, filePath)} (already compatible)`);
}

function mergePackageJson(
  existing: Record<string, unknown>,
  template: Record<string, unknown>,
): { value: Record<string, unknown>; changed: boolean } {
  const merged: Record<string, unknown> = { ...existing };
  const scripts = {
    ...(typeof existing.scripts === "object" && existing.scripts !== null
      ? (existing.scripts as Record<string, string>)
      : {}),
  };
  scripts["orbit:publish"] = "orbit-publish";
  merged.scripts = scripts;

  const dependencies = {
    ...(typeof existing.dependencies === "object" && existing.dependencies !== null
      ? (existing.dependencies as Record<string, string>)
      : {}),
  };
  const templateDeps = template.dependencies as Record<string, string>;
  if (!dependencies["@orbit-0g/sdk"]) {
    dependencies["@orbit-0g/sdk"] = templateDeps["@orbit-0g/sdk"];
  }
  merged.dependencies = dependencies;

  const templateOpenclaw = template.openclaw as Record<string, unknown>;
  const existingOpenclaw =
    typeof existing.openclaw === "object" && existing.openclaw !== null
      ? (existing.openclaw as Record<string, unknown>)
      : {};
  const existingCompat =
    typeof existingOpenclaw.compat === "object" && existingOpenclaw.compat !== null
      ? (existingOpenclaw.compat as Record<string, unknown>)
      : {};
  const templateCompat = templateOpenclaw.compat as Record<string, unknown>;
  const existingBuild =
    typeof existingOpenclaw.build === "object" && existingOpenclaw.build !== null
      ? (existingOpenclaw.build as Record<string, unknown>)
      : {};
  const templateBuild = templateOpenclaw.build as Record<string, unknown>;
  merged.openclaw = {
    ...existingOpenclaw,
    extensions: existingOpenclaw.extensions ?? templateOpenclaw.extensions,
    compat: { ...existingCompat, ...templateCompat },
    build: { ...existingBuild, ...templateBuild },
  };

  const keywords = Array.isArray(existing.keywords)
    ? [...(existing.keywords as string[])]
    : [];
  for (const kw of ["openclaw", "plugin", "orbit"]) {
    if (!keywords.includes(kw)) keywords.push(kw);
  }
  merged.keywords = keywords;

  const changed = JSON.stringify(merged) !== JSON.stringify(existing);
  return { value: merged, changed };
}

function mergeOpenclawPluginJson(
  existing: Record<string, unknown>,
  template: Record<string, unknown>,
): { value: Record<string, unknown>; changed: boolean } {
  const merged: Record<string, unknown> = { ...existing };
  const orbit =
    typeof existing.orbit === "object" && existing.orbit !== null
      ? { ...(existing.orbit as Record<string, unknown>) }
      : {};
  orbit.billing = true;
  merged.orbit = orbit;

  if (!merged.activation) {
    merged.activation = template.activation;
  }

  const existingSchema =
    typeof merged.configSchema === "object" && merged.configSchema !== null
      ? (merged.configSchema as Record<string, unknown>)
      : {};
  const existingProps =
    typeof existingSchema.properties === "object" && existingSchema.properties !== null
      ? (existingSchema.properties as Record<string, unknown>)
      : {};
  const templateSchema = template.configSchema as Record<string, unknown>;
  const templateProps = templateSchema.properties as Record<string, unknown>;
  merged.configSchema = {
    type: existingSchema.type ?? "object",
    additionalProperties: existingSchema.additionalProperties ?? false,
    properties: {
      ...existingProps,
      privateKey: existingProps.privateKey ?? templateProps.privateKey,
    },
  };

  const changed = JSON.stringify(merged) !== JSON.stringify(existing);
  return { value: merged, changed };
}

function mergeEnvExampleContent(existingRaw?: string): string {
  const parsed = existingRaw ? parseDotEnv(existingRaw) : {};
  for (const key of OBSOLETE_ENV_KEYS) delete parsed[key];

  const merged: Record<string, string> = { ...ENV_EXAMPLE_DEFAULTS };
  for (const [key, value] of Object.entries(parsed)) {
    merged[key] = value;
  }

  const order = [
    "PRIVATE_KEY",
    "PLUGIN_KEY",
    "ORBIT_PLUGIN_ID",
    "ORBIT_BILLING_RECORD_INSTALL",
  ];
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const key of order) {
    if (key in merged) {
      lines.push(`${key}=${merged[key]}`);
      seen.add(key);
    }
  }
  for (const [key, value] of Object.entries(merged)) {
    if (!seen.has(key)) lines.push(`${key}=${value}`);
  }
  return `${lines.join("\n")}\n`;
}

function writeOrMergePackageJson(
  filePath: string,
  template: Record<string, unknown>,
): void {
  if (!fs.existsSync(filePath)) {
    writeJson(filePath, template, "create");
    return;
  }
  const existing = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
  const { value, changed } = mergePackageJson(existing, template);
  writeJson(filePath, value, changed ? "update" : "ok");
}

function writeOrMergeOpenclawPluginJson(
  filePath: string,
  template: Record<string, unknown>,
): void {
  if (!fs.existsSync(filePath)) {
    writeJson(filePath, template, "create");
    return;
  }
  const existing = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
  const { value, changed } = mergeOpenclawPluginJson(existing, template);
  writeJson(filePath, value, changed ? "update" : "ok");
}

function writeOrMergeEnvExample(filePath: string): void {
  const content = mergeEnvExampleContent(
    fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : undefined,
  );
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`  create  ${path.relative(cwd, filePath)}`);
    return;
  }
  const previous = fs.readFileSync(filePath, "utf8");
  if (previous === content) {
    console.log(`  ok  ${path.relative(cwd, filePath)} (already compatible)`);
    return;
  }
  fs.writeFileSync(filePath, content, "utf8");
  console.log(`  update  ${path.relative(cwd, filePath)}`);
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
      "orbit:publish": "orbit-publish",
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

  const gitignore = `node_modules/
dist/
.env
`;

  writeOrMergePackageJson(path.join(cwd, "package.json"), packageJson);
  writeOrMergeOpenclawPluginJson(path.join(cwd, "openclaw.plugin.json"), openclawPluginJson);
  writeIfMissing(path.join(cwd, "tsconfig.json"), JSON.stringify(tsconfigJson, null, 2) + "\n");
  writeIfMissing(path.join(cwd, "tsconfig.build.json"), JSON.stringify(tsconfigBuildJson, null, 2) + "\n");
  writeIfMissing(path.join(cwd, "index.ts"), indexTs);
  writeOrMergeEnvExample(path.join(cwd, ".env.example"));
  writeIfMissing(path.join(cwd, ".gitignore"), gitignore);

  console.log(`
  Done! Next steps:

    npm install
    # set PRIVATE_KEY in .env; ORBIT_PLUGIN_ID is written by orbit:publish
    # edit index.ts to add your tools
    npm run orbit:publish
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
