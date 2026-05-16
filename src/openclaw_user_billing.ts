import { orbitSdkLog } from "./orbit_log.js";
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

export function registerOrbitUserBilling(
  api: OrbitOpenClawPluginApi,
  options: RegisterOrbitUserBillingOptions = {},
): void {
  const {
    promptOnGatewayStart = true,
    blockToolsWithoutWallet = true,
    hookOrbitPluginInstalls = true,
  } = options;

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
        if (hasUserPrivateKey()) return;
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

  api.on(
    "before_tool_call",
    async (event) => {
      const toolName =
        event &&
        typeof event === "object" &&
        "toolName" in event &&
        typeof (event as { toolName?: unknown }).toolName === "string"
          ? (event as { toolName: string }).toolName
          : "";
      applyPluginConfigPrivateKey(api.pluginConfig);
      orbitSdkLog(
        "info",
        "openclaw.hook.before_tool_call",
        {
          toolName,
          pluginId: api.id ?? "",
          hasWallet: String(hasUserPrivateKey()),
          note: "billing.* logs appear only when your tool calls sdk.billing.recordUsage",
        },
        api.logger,
      );
      if (blockToolsWithoutWallet && !hasUserPrivateKey()) {
        return {
          block: true,
          blockReason: WALLET_SETUP_HINT,
        };
      }
      return;
    },
    { priority: 100 },
  );
}
