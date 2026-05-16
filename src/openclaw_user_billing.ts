import { orbitSdkLog } from "./orbit_log.js";
import type { Hex } from "viem";
import { createBilling } from "./billing.js";
import type { OrbitBillingClient } from "./types.js";
import {
  OrbitUserNotConfiguredError,
  applyPluginConfigPrivateKey,
  hasUserPrivateKey,
  persistUserPrivateKey,
} from "./user_config.js";
import { runOrbitUserWalletSetup } from "./user_wallet_setup.js";

export type OrbitOpenClawPluginApi = {
  id?: string;
  pluginConfig?: Record<string, unknown>;
  registrationMode?: string;
  logger?: {
    info: (message: string) => void;
    warn: (message: string) => void;
  };
  on: (
    name: string,
    handler: (event: unknown, ctx?: unknown) => unknown | Promise<unknown>,
    opts?: { priority?: number },
  ) => void;
  registerCli: (
    register: (ctx: { program: CliProgram }) => void,
    opts?: { descriptors?: CliDescriptor[] },
  ) => void;
};

type CliProgram = {
  command: (name: string) => CliCommand;
};

type CliCommand = {
  command: (name: string) => CliCommand;
  description: (text: string) => CliCommand;
  action: (fn: () => void | Promise<void>) => void;
};

type CliDescriptor = {
  name: string;
  description: string;
  hasSubcommands?: boolean;
};

export type RegisterOrbitUserBillingOptions = {
  pluginId?: string;
  promptOnGatewayStart?: boolean;
  blockToolsWithoutWallet?: boolean;
  hookOrbitPluginInstalls?: boolean;
};

const WALLET_SETUP_HINT =
  "Run: openclaw orbit wallet setup — required before using paid Orbit plugins.";

const MISSING_ORBIT_PLUGIN_ID_NOTE =
  "No Orbit on-chain plugin id: set ORBIT_PLUGIN_ID or PLUGIN_KEY (0x + 64 hex from orbit-publish .env) or registerOrbitUserBilling(api, { pluginId }). OpenClaw plugin id is not used for billing.";

function isOrbitBilledPluginManifest(manifest: unknown): boolean {
  if (!manifest || typeof manifest !== "object") return false;
  const record = manifest as Record<string, unknown>;
  if (record.orbit === true) return true;
  if (record.orbit && typeof record.orbit === "object") {
    const orbit = record.orbit as Record<string, unknown>;
    if (orbit.billing === true) return true;
  }
  return false;
}

function readInstallManifest(event: unknown): unknown {
  if (!event || typeof event !== "object") return null;
  const record = event as Record<string, unknown>;
  return (
    record.manifest ??
    record.pluginManifest ??
    (record.scan as Record<string, unknown> | undefined)?.manifest ??
    null
  );
}

export async function ensureOrbitWalletForOpenClaw(
  api?: Pick<OrbitOpenClawPluginApi, "pluginConfig" | "logger">,
): Promise<void> {
  applyPluginConfigPrivateKey(api?.pluginConfig);
  if (!hasUserPrivateKey()) {
    orbitSdkLog(
      "warn",
      "openclaw.wallet.missing",
      {
        note: "Plugin tool path blocked until wallet configured; no billing tx sent.",
      },
      api?.logger,
    );
    throw new OrbitUserNotConfiguredError(WALLET_SETUP_HINT);
  }
  orbitSdkLog(
    "info",
    "openclaw.wallet.ok",
    {
      note: "PRIVATE_KEY present; billing calls may proceed.",
    },
    api?.logger,
  );
}

function resolvePluginId(options: RegisterOrbitUserBillingOptions): Hex | null {
  const fromOpt = (options.pluginId ?? "").trim();
  if (fromOpt) return fromOpt as Hex;
  const fromEnv = (
    process.env.ORBIT_PLUGIN_ID ??
    process.env.PLUGIN_KEY ??
    ""
  ).trim();
  if (fromEnv) return fromEnv as Hex;
  return null;
}

function readToolName(event: unknown): string {
  if (!event || typeof event !== "object") return "unknown";
  const record = event as Record<string, unknown>;
  const name = record.toolName ?? record.tool ?? record.name;
  return typeof name === "string" && name ? name : "unknown";
}

export function registerOrbitUserBilling(
  api: OrbitOpenClawPluginApi,
  options: RegisterOrbitUserBillingOptions = {},
): void {
  const {
    promptOnGatewayStart = true,
    blockToolsWithoutWallet = true,
    hookOrbitPluginInstalls = true,
  } = options;

  let billing: OrbitBillingClient | null = null;

  function getBilling(): OrbitBillingClient {
    if (!billing) {
      billing = createBilling();
    }
    return billing;
  }

  api.registerCli(
    ({ program }) => {
      const orbit = program.command("orbit").description("Orbit billing wallet");
      const wallet = orbit.command("wallet").description("Orbit wallet commands");
      wallet
        .command("setup")
        .description("Configure your Orbit wallet private key for paid plugins")
        .action(async () => {
          const envPath = await runOrbitUserWalletSetup({
            replaceExisting: hasUserPrivateKey(),
          });
          console.log(`Orbit wallet saved to ${envPath}`);
        });
    },
    {
      descriptors: [
        {
          name: "orbit",
          description: "Orbit billing wallet",
          hasSubcommands: true,
        },
      ],
    },
  );

  if (hookOrbitPluginInstalls) {
    api.on(
      "before_install",
      async (event) => {
        const manifest = readInstallManifest(event);
        orbitSdkLog(
          "info",
          "openclaw.hook.before_install",
          {
            pluginId: api.id ?? "",
            orbitBilledCandidate: String(isOrbitBilledPluginManifest(manifest)),
            note: "SDK does not call OrbitRegistry on install; wallet prompt only for orbit-billed manifests.",
          },
          api.logger,
        );
        if (!isOrbitBilledPluginManifest(manifest)) return;
        applyPluginConfigPrivateKey(api.pluginConfig);
        if (!hasUserPrivateKey()) {
          try {
            const envPath = await runOrbitUserWalletSetup();
            api.logger?.info(`Orbit wallet configured at ${envPath}`);
          } catch (err) {
            const message =
              err instanceof Error ? err.message : "Orbit wallet setup failed";
            return {
              block: true,
              blockReason: `${message} ${WALLET_SETUP_HINT}`,
            };
          }
        }

        hasUserPrivateKey();
        const installPluginId = resolvePluginId(options);
        if (installPluginId) {
          try {
            const receipt = await getBilling().recordInstall(installPluginId);
            api.logger?.info(
              `Orbit install recorded — tx: ${receipt.txHash}, charged: ${receipt.chargedWei} wei`,
            );
          } catch (err) {
            const message =
              err instanceof Error ? err.message : "Orbit billing failed";
            api.logger?.warn(`Install billing failed: ${message}`);
            return {
              block: true,
              blockReason: `Install billing failed: ${message}`,
            };
          }
        }
      },
      { priority: 100 },
    );
  }

  if (promptOnGatewayStart) {
    api.on("gateway_start", async () => {
      orbitSdkLog(
        "info",
        "openclaw.hook.gateway_start",
        {
          pluginId: api.id ?? "",
          note: "SDK does not register plugins on chain here; OrbitRegistry is only used by orbit-publish.",
        },
        api.logger,
      );
      const fromConfig = api.pluginConfig?.privateKey;
      if (typeof fromConfig === "string" && fromConfig.trim()) {
        persistUserPrivateKey(fromConfig);
        return;
      }
      applyPluginConfigPrivateKey(api.pluginConfig);
      if (hasUserPrivateKey()) return;
      try {
        const envPath = await runOrbitUserWalletSetup();
        api.logger?.info(`Orbit wallet configured at ${envPath}`);
      } catch (err) {
        api.logger?.warn(
          err instanceof Error ? err.message : "Orbit wallet setup skipped",
        );
      }
    });
  }

  if (blockToolsWithoutWallet) {
    api.on(
      "before_tool_call",
      async (event, ctx) => {
        const toolName =
          event &&
            typeof event === "object" &&
            "toolName" in event &&
            typeof (event as { toolName?: unknown }).toolName === "string"
            ? (event as { toolName: string }).toolName
            : "";
        applyPluginConfigPrivateKey(api.pluginConfig);
        const walletReady = hasUserPrivateKey();
        const usagePluginId = resolvePluginId(options);
        orbitSdkLog(
          "info",
          "openclaw.hook.before_tool_call",
          {
            toolName,
            openclawPluginId: api.id ?? "",
            orbitBillingPluginId: usagePluginId ?? "",
            hasWallet: String(walletReady),
            note: "orbitBillingPluginId must be set or billing txs are skipped.",
          },
          api.logger,
        );
        api.logger?.info(
          `Orbit billing check — tool=${toolName || "(unknown)"} openclawId=${api.id ?? ""} onChainId=${usagePluginId ?? "(none)"} wallet=${walletReady ? "yes" : "no"}`,
        );
        if (!walletReady) {
          api.logger?.info(
            "Orbit billing: blocking tool (wallet not configured). Run: openclaw orbit wallet setup",
          );
          return {
            block: true,
            blockReason: WALLET_SETUP_HINT,
          };
        }

        if (!usagePluginId) {
          orbitSdkLog(
            "warn",
            "openclaw.billing.skipped.no_orbit_plugin_id",
            {
              toolName,
              openclawPluginId: api.id ?? "",
              note: MISSING_ORBIT_PLUGIN_ID_NOTE,
            },
            api.logger,
          );
          api.logger?.info(
            `Orbit billing: skipped (no on-chain plugin id). ${MISSING_ORBIT_PLUGIN_ID_NOTE}`,
          );
          return;
        }

        const resolvedToolName = readToolName(event);
        api.logger?.info(
          `Orbit billing: sending recordUsage on-chain — pluginId=${usagePluginId} tool=${resolvedToolName}`,
        );
        try {
          const receipt = await getBilling().recordUsage(
            usagePluginId,
            resolvedToolName,
          );
          api.logger?.info(
            `Orbit billing: usage recorded — tool=${resolvedToolName} tx=${receipt.txHash} chargedWei=${receipt.chargedWei}`,
          );
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Orbit billing failed";
          api.logger?.info(`Orbit billing: failed — ${message}`);
          return {
            block: true,
            blockReason: `Usage billing failed: ${message}`,
          };
        }
      },
      { priority: 100 },
    );
  }
}
