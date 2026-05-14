import {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  http,
  keccak256,
  parseAbiParameters,
  type Address,
  type Hex
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { orbitRegistryAbi } from "./abis.js";
import { getAnyEnvOrPrompt, getEnvOrPrompt } from "./runtime_config.js";
import type {
  OrbitPlugin,
  OrbitRegistryClient,
  RegisterPluginInput,
  RegisterPluginReceipt,
  UpdatePluginInput,
  UpdatePluginReceipt
} from "./types.js";

type CreateOrbitRegistryClientConfig = {
  rpcUrl: string;
  privateKey: Hex;
  registryAddress: Address;
  chainId?: number;
  chainName?: string;
};

async function loadRegistryConfig(): Promise<CreateOrbitRegistryClientConfig> {
  const rpcUrl = await getAnyEnvOrPrompt({
    envKeys: ["ORBIT_RPC_URL", "RPC_URL"],
    promptMessage: "Enter Orbit RPC URL"
  });
  const privateKey = (await getEnvOrPrompt({
    envKey: "PRIVATE_KEY",
    promptMessage: "Enter private key",
    secret: true,
    validate: (value) =>
      value.startsWith("0x") && value.length === 66 ? true : "Expected 0x + 64 hex chars"
  })) as Hex;
  const registryAddress = (await getEnvOrPrompt({
    envKey: "ORBIT_REGISTRY_ADDRESS",
    promptMessage: "Enter OrbitRegistry address",
    validate: (value) =>
      value.startsWith("0x") && value.length === 42 ? true : "Expected 0x + 40 hex chars"
  })) as Address;
  const chainIdRaw = (process.env.ORBIT_CHAIN_ID ?? "").trim();
  const chainId = chainIdRaw ? Number(chainIdRaw) : undefined;
  const chainName = (process.env.ORBIT_CHAIN_NAME ?? "").trim() || undefined;
  return { rpcUrl, privateKey, registryAddress, chainId, chainName };
}

function buildChain(config: CreateOrbitRegistryClientConfig) {
  const envChainId = Number(process.env.ORBIT_CHAIN_ID ?? "");
  const fallbackChainId = Number.isFinite(envChainId) && envChainId > 0 ? envChainId : 16601;
  return {
    id: config.chainId ?? fallbackChainId,
    name: config.chainName ?? process.env.ORBIT_CHAIN_NAME ?? "Orbit",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [config.rpcUrl] } }
  };
}

export function createOrbitRegistryClient(
  config: CreateOrbitRegistryClientConfig
): OrbitRegistryClient {
  const account = privateKeyToAccount(config.privateKey);
  const chain = buildChain(config);

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(config.rpcUrl)
  });

  const publicClient = createPublicClient({
    chain,
    transport: http(config.rpcUrl)
  });

  return {
    async registerPlugin(input: RegisterPluginInput): Promise<RegisterPluginReceipt> {
      const txHash = await walletClient.writeContract({
        address: config.registryAddress,
        abi: orbitRegistryAbi,
        functionName: "registerPlugin",
        args: [
          input.name,
          input.version,
          input.slug,
          input.description,
          input.pricePerInstall,
          input.pricePerUsage
        ]
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      const pluginId = keccak256(
        encodeAbiParameters(
          parseAbiParameters("string, string, address"),
          [input.name, input.version, account.address]
        )
      );

      return {
        txHash,
        blockNumber: receipt.blockNumber,
        pluginId
      };
    },

    async updatePlugin(input: UpdatePluginInput): Promise<UpdatePluginReceipt> {
      const txHash = await walletClient.writeContract({
        address: config.registryAddress,
        abi: orbitRegistryAbi,
        functionName: "updatePlugin",
        args: [input.pluginId, input.slug, input.description]
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      return {
        txHash,
        blockNumber: receipt.blockNumber
      };
    },

    async deactivatePlugin(pluginId: Hex) {
      const txHash = await walletClient.writeContract({
        address: config.registryAddress,
        abi: orbitRegistryAbi,
        functionName: "deactivatePlugin",
        args: [pluginId]
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      return {
        txHash,
        blockNumber: receipt.blockNumber
      };
    },

    async getPlugin(pluginId: Hex): Promise<OrbitPlugin> {
      const plugin = await publicClient.readContract({
        address: config.registryAddress,
        abi: orbitRegistryAbi,
        functionName: "getPlugin",
        args: [pluginId]
      });

      return plugin as OrbitPlugin;
    },

    async isRegistered(pluginId: Hex): Promise<boolean> {
      return publicClient.readContract({
        address: config.registryAddress,
        abi: orbitRegistryAbi,
        functionName: "isRegistered",
        args: [pluginId]
      });
    },

    async getPluginsByOwner(owner: Address): Promise<Hex[]> {
      const pluginIds = await publicClient.readContract({
        address: config.registryAddress,
        abi: orbitRegistryAbi,
        functionName: "getPluginsByOwner",
        args: [owner]
      });
      return [...pluginIds];
    }
  };
}

export function createRegistry(): OrbitRegistryClient {
  let clientPromise: Promise<OrbitRegistryClient> | null = null;
  async function getClient(): Promise<OrbitRegistryClient> {
    if (!clientPromise) {
      clientPromise = loadRegistryConfig().then((config) => createOrbitRegistryClient(config));
    }
    return clientPromise;
  }
  return {
    async registerPlugin(input) {
      const client = await getClient();
      return client.registerPlugin(input);
    },
    async updatePlugin(input) {
      const client = await getClient();
      return client.updatePlugin(input);
    },
    async deactivatePlugin(pluginId) {
      const client = await getClient();
      return client.deactivatePlugin(pluginId);
    },
    async getPlugin(pluginId) {
      const client = await getClient();
      return client.getPlugin(pluginId);
    },
    async isRegistered(pluginId) {
      const client = await getClient();
      return client.isRegistered(pluginId);
    },
    async getPluginsByOwner(owner) {
      const client = await getClient();
      return client.getPluginsByOwner(owner);
    }
  };
}
