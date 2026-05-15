import { http, type Hash, type PublicClient } from "viem";

const RECEIPT_TIMEOUT_MS = 600_000;
const RECEIPT_POLLING_MS = 4_000;
const RECEIPT_WAIT_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isReceiptWaitError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("could not be found") ||
    msg.includes("not be processed") ||
    msg.includes("timeout") ||
    msg.includes("receipt")
  );
}

export function createChainTransport(rpcUrl: string) {
  return http(rpcUrl, {
    retryCount: 5,
    retryDelay: 1_000,
    timeout: 60_000,
  });
}

export function resolveRpcUrl(): string {
  const fromEnv = (process.env.ORBIT_RPC_URL ?? process.env.RPC_URL ?? "").trim();
  return fromEnv || "https://evmrpc-testnet.0g.ai";
}

export async function waitForTransactionReceiptReliable(
  publicClient: PublicClient,
  hash: Hash,
) {
  let lastError: unknown;

  for (let attempt = 0; attempt < RECEIPT_WAIT_ATTEMPTS; attempt++) {
    try {
      return await publicClient.waitForTransactionReceipt({
        hash,
        timeout: RECEIPT_TIMEOUT_MS,
        pollingInterval: RECEIPT_POLLING_MS,
      });
    } catch (err) {
      lastError = err;
      if (!isReceiptWaitError(err) || attempt === RECEIPT_WAIT_ATTEMPTS - 1) break;
      await sleep(RECEIPT_POLLING_MS);
    }
  }

  const tx = await publicClient.getTransaction({ hash }).catch(() => null);
  if (!tx) {
    throw new Error(
      `Transaction ${hash} was not found on the RPC. Verify ORBIT_RPC_URL points to 0G Galileo testnet (chain id 16602).`,
      { cause: lastError },
    );
  }

  throw new Error(
    `Timed out waiting for receipt for ${hash}. The transaction was submitted but not confirmed within ${RECEIPT_TIMEOUT_MS / 1000}s. Check a block explorer or retry orbit-publish.`,
    { cause: lastError },
  );
}
