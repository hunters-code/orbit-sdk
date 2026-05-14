import { createBilling, createOrbitBillingClient } from "./billing.js";
import { createPublisher } from "./publisher.js";
import { createOrbitRegistryClient, createRegistry } from "./registry.js";
import { createStorage } from "./storage.js";
import type { CreateOrbitSdkConfig, OrbitSdk } from "./types.js";

function readAddress(value: string | undefined, envKey: string): `0x${string}` {
  const resolved = (value ?? process.env[envKey] ?? "").trim();
  if (!resolved) {
    throw new Error(`Missing ${envKey}`);
  }
  return resolved as `0x${string}`;
}

export function createOrbitSdk(config: CreateOrbitSdkConfig): OrbitSdk {
  if (!config) {
    return {
      registry: createRegistry(),
      billing: createBilling(),
      storage: createStorage(),
      publisher: createPublisher()
    };
  }

  const registryAddress: `0x${string}` = "0xbd83d0ae87efc9a2571bf03a7f5bb1e1cdba1954";
  const billingAddress: `0x${string}` = "0x34e3fea4cbd6604becc0a87ace8aa831b23f5314";
  const rpcUrl = "https://evmrpc-testnet.0g.ai";
  const privateKey = readAddress(config.privateKey, "PRIVATE_KEY");

  return {
    registry: createOrbitRegistryClient({
      rpcUrl,
      privateKey,
      registryAddress,
      chainId: 16602,
      chainName: "0G-Galileo-Testnet"
    }),
    billing: createOrbitBillingClient({
      rpcUrl,
      privateKey,
      registryAddress,
      billingAddress,
      chainId: 16602,
      chainName: "0G-Galileo-Testnet"
    }),
    get storage() { return createStorage(); },
    publisher: createPublisher()
  };
}
