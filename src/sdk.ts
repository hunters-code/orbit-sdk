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

function readRequired(value: string | undefined, envKey: string): string {
  const resolved = (value ?? process.env[envKey] ?? "").trim();
  if (!resolved) {
    throw new Error(`Missing ${envKey}`);
  }
  return resolved;
}

export function createOrbitSdk(config?: CreateOrbitSdkConfig): OrbitSdk {
  if (!config) {
    return {
      registry: createRegistry(),
      billing: createBilling(),
      storage: createStorage(),
      publisher: createPublisher()
    };
  }

  const registryAddress = readAddress(config.registryAddress, "ORBIT_REGISTRY_ADDRESS");
  const billingAddress = readAddress(config.billingAddress, "ORBIT_BILLING_ADDRESS");
  const rpcUrl = readRequired(config.rpcUrl, "ORBIT_RPC_URL");
  const privateKey = readAddress(config.privateKey, "PRIVATE_KEY");

  return {
    registry: createOrbitRegistryClient({
      rpcUrl,
      privateKey,
      registryAddress,
      chainId: config.chainId,
      chainName: config.chainName
    }),
    billing: createOrbitBillingClient({
      rpcUrl,
      privateKey,
      registryAddress,
      billingAddress,
      chainId: config.chainId,
      chainName: config.chainName
    }),
    storage: createStorage(),
    publisher: createPublisher()
  };
}
