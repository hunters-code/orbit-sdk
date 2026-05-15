import {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  keccak256,
  parseAbiParameters,
  type Address,
  type Hex
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { orbitRegistryAbi } from "./abis.js";
import {
  createChainTransport,
  resolveRpcUrl,
  waitForTransactionReceiptReliable,
} from "./chain_tx.js";
import { getEnvOrPrompt } from "./runtime_config.js";
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
  const privateKey = (await getEnvOrPrompt({
    envKey: "PRIVATE_KEY",
    promptMessage: "Enter private key",
    secret: true,
    validate: (value) =>
      value.startsWith("0x") && value.length === 66 ? true : "Expected 0x + 64 hex chars"
  })) as Hex;
  const rpcUrl = resolveRpcUrl();
  const registryAddress: Address = "0xbd83d0ae87efc9a2571bf03a7f5bb1e1cdba1954";
  const chainId = 16602;
  const chainName = "0G Galileo Testnet";
  return { rpcUrl, privateKey, registryAddress, chainId, chainName };
}

function buildChain(config: CreateOrbitRegistryClientConfig) {
  return {
    id: config.chainId ?? 16602,
    name: config.chainName ?? "0G Galileo Testnet",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [config.rpcUrl] } }
  };
}

export function computePluginId(name: string, version: string, owner: Address): Hex {
  return keccak256(
    encodeAbiParameters(parseAbiParameters("string, string, address"), [
      name,
      version,
      owner
    ])
  );
}

export function createOrbitRegistryClient(
  config: CreateOrbitRegistryClientConfig
): OrbitRegistryClient {
  const account = privateKeyToAccount(config.privateKey);
  const chain = buildChain(config);

  const transport = createChainTransport(config.rpcUrl);

  const walletClient = createWalletClient({
    account,
    chain,
    transport,
  });

  const publicClient = createPublicClient({
    chain,
    transport,
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

      const receipt = await waitForTransactionReceiptReliable(publicClient, txHash);
      const pluginId = computePluginId(input.name, input.version, account.address);

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

      const receipt = await waitForTransactionReceiptReliable(publicClient, txHash);

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

      const receipt = await waitForTransactionReceiptReliable(publicClient, txHash);

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
    },

    async getSignerAddress(): Promise<Address> {
      return account.address;
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
    },
    async getSignerAddress() {
      const client = await getClient();
      return client.getSignerAddress();
    }
  };
}
