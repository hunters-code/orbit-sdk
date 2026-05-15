import { createPublicClient, createWalletClient, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { orbitBillingAbi, orbitRegistryAbi } from "./abis.js";
import {
  createChainTransport,
  resolveRpcUrl,
  waitForTransactionReceiptReliable,
} from "./chain_tx.js";
import { getEnvOrPrompt } from "./runtime_config.js";
import type { BillingReceipt, OrbitBillingClient } from "./types.js";

type CreateOrbitBillingClientConfig = {
  rpcUrl: string;
  privateKey: Hex;
  registryAddress: Address;
  billingAddress: Address;
  chainId?: number;
  chainName?: string;
};

async function loadBillingConfig(): Promise<CreateOrbitBillingClientConfig> {
  const privateKey = (await getEnvOrPrompt({
    envKey: "PRIVATE_KEY",
    promptMessage: "Enter private key",
    secret: true,
    validate: (value) =>
      value.startsWith("0x") && value.length === 66 ? true : "Expected 0x + 64 hex chars"
  })) as Hex;
  const rpcUrl = resolveRpcUrl();
  const registryAddress: Address = "0xbd83d0ae87efc9a2571bf03a7f5bb1e1cdba1954";
  const billingAddress: Address = "0x34e3fea4cbd6604becc0a87ace8aa831b23f5314";
  const chainId = 16602;
  const chainName = "0G Galileo Testnet";
  return { rpcUrl, privateKey, registryAddress, billingAddress, chainId, chainName };
}

function buildChain(config: CreateOrbitBillingClientConfig) {
  return {
    id: config.chainId ?? 16602,
    name: config.chainName ?? "0G Galileo Testnet",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [config.rpcUrl] } }
  };
}

export function createOrbitBillingClient(config: CreateOrbitBillingClientConfig): OrbitBillingClient {
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

  async function getInstallPrice(pluginId: Hex): Promise<bigint> {
    const plugin = await publicClient.readContract({
      address: config.registryAddress,
      abi: orbitRegistryAbi,
      functionName: "getPlugin",
      args: [pluginId]
    });
    return plugin.pricePerInstall;
  }

  async function getUsagePrice(pluginId: Hex): Promise<bigint> {
    const plugin = await publicClient.readContract({
      address: config.registryAddress,
      abi: orbitRegistryAbi,
      functionName: "getPlugin",
      args: [pluginId]
    });
    return plugin.pricePerUsage;
  }

  return {
    async recordInstall(pluginId: Hex): Promise<BillingReceipt> {
      const value = await getInstallPrice(pluginId);
      const txHash = await walletClient.writeContract({
        address: config.billingAddress,
        abi: orbitBillingAbi,
        functionName: "recordInstall",
        args: [pluginId],
        value
      });

      const receipt = await waitForTransactionReceiptReliable(publicClient, txHash);
      return {
        txHash,
        blockNumber: receipt.blockNumber,
        chargedWei: value
      };
    },

    async recordUsage(pluginId: Hex, toolName: string): Promise<BillingReceipt> {
      const value = await getUsagePrice(pluginId);
      const txHash = await walletClient.writeContract({
        address: config.billingAddress,
        abi: orbitBillingAbi,
        functionName: "recordUsage",
        args: [pluginId, toolName],
        value
      });

      const receipt = await waitForTransactionReceiptReliable(publicClient, txHash);
      return {
        txHash,
        blockNumber: receipt.blockNumber,
        chargedWei: value
      };
    },

    async withdraw(pluginId: Hex) {
      const txHash = await walletClient.writeContract({
        address: config.billingAddress,
        abi: orbitBillingAbi,
        functionName: "withdraw",
        args: [pluginId]
      });

      const receipt = await waitForTransactionReceiptReliable(publicClient, txHash);
      return {
        txHash,
        blockNumber: receipt.blockNumber
      };
    },

    async getEarnings(pluginId: Hex): Promise<bigint> {
      return publicClient.readContract({
        address: config.billingAddress,
        abi: orbitBillingAbi,
        functionName: "earnings",
        args: [pluginId]
      });
    },

    async getInstallCount(pluginId: Hex): Promise<bigint> {
      return publicClient.readContract({
        address: config.billingAddress,
        abi: orbitBillingAbi,
        functionName: "installCount",
        args: [pluginId]
      });
    },

    async getUsageCount(pluginId: Hex): Promise<bigint> {
      return publicClient.readContract({
        address: config.billingAddress,
        abi: orbitBillingAbi,
        functionName: "usageCount",
        args: [pluginId]
      });
    }
  };
}

export function createBilling(): OrbitBillingClient {
  let clientPromise: Promise<OrbitBillingClient> | null = null;
  async function getClient(): Promise<OrbitBillingClient> {
    if (!clientPromise) {
      clientPromise = loadBillingConfig().then((config) => createOrbitBillingClient(config));
    }
    return clientPromise;
  }
  return {
    async recordInstall(pluginId) {
      const client = await getClient();
      return client.recordInstall(pluginId);
    },
    async recordUsage(pluginId, toolName) {
      const client = await getClient();
      return client.recordUsage(pluginId, toolName);
    },
    async withdraw(pluginId) {
      const client = await getClient();
      return client.withdraw(pluginId);
    },
    async getEarnings(pluginId) {
      const client = await getClient();
      return client.getEarnings(pluginId);
    },
    async getInstallCount(pluginId) {
      const client = await getClient();
      return client.getInstallCount(pluginId);
    },
    async getUsageCount(pluginId) {
      const client = await getClient();
      return client.getUsageCount(pluginId);
    }
  };
}
