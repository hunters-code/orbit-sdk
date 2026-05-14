import type { Address, Hex } from "viem";

export type OrbitPlugin = {
  id: Hex;
  name: string;
  version: string;
  owner: Address;
  slug: string;
  description: string;
  pricePerInstall: bigint;
  pricePerUsage: bigint;
  isActive: boolean;
  createdAt: bigint;
  updatedAt: bigint;
};

export type RegisterPluginInput = {
  name: string;
  version: string;
  slug: string;
  description: string;
  pricePerInstall: bigint;
  pricePerUsage: bigint;
};

export type RegisterPluginReceipt = {
  txHash: Hex;
  blockNumber: bigint;
  pluginId: Hex;
};

export type UpdatePluginInput = {
  pluginId: Hex;
  slug: string;
  description: string;
};

export type UpdatePluginReceipt = {
  txHash: Hex;
  blockNumber: bigint;
};

export type DeactivatePluginReceipt = {
  txHash: Hex;
  blockNumber: bigint;
};

export type BillingReceipt = {
  txHash: Hex;
  blockNumber: bigint;
  chargedWei: bigint;
};

export interface OrbitRegistryClient {
  registerPlugin(input: RegisterPluginInput): Promise<RegisterPluginReceipt>;
  updatePlugin(input: UpdatePluginInput): Promise<UpdatePluginReceipt>;
  deactivatePlugin(pluginId: Hex): Promise<DeactivatePluginReceipt>;
  getPlugin(pluginId: Hex): Promise<OrbitPlugin>;
  isRegistered(pluginId: Hex): Promise<boolean>;
  getPluginsByOwner(owner: Address): Promise<Hex[]>;
}

export interface OrbitBillingClient {
  recordInstall(pluginId: Hex): Promise<BillingReceipt>;
  recordUsage(pluginId: Hex, toolName: string): Promise<BillingReceipt>;
  withdraw(pluginId: Hex): Promise<{ txHash: Hex; blockNumber: bigint }>;
  getEarnings(pluginId: Hex): Promise<bigint>;
  getInstallCount(pluginId: Hex): Promise<bigint>;
  getUsageCount(pluginId: Hex): Promise<bigint>;
}

export type PluginContextData = {
  pluginId: string;
  version: string;
  context: unknown;
};

export interface OrbitStorageClient {
  upload(data: PluginContextData): Promise<string>;
  download(hash: string): Promise<PluginContextData>;
}

export type PublishOptions = {
  cwd?: string;
  target?: string;
  family?: "code-plugin" | "bundle-plugin";
  extraArgs?: string[];
};

export interface OrbitPublisherClient {
  publish(options?: PublishOptions): Promise<void>;
}

export type OrbitSdk = {
  registry: OrbitRegistryClient;
  billing: OrbitBillingClient;
  storage: OrbitStorageClient;
  publisher: OrbitPublisherClient;
};

export type CreateOrbitSdkConfig = {
  privateKey: Hex;
};
