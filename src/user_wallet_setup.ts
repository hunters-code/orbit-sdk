import { password } from "@inquirer/prompts";
import {
  hasUserPrivateKey,
  persistUserPrivateKey,
  resolveUserEnvPath,
} from "./user_config.js";

export type RunOrbitUserWalletSetupOptions = {
  replaceExisting?: boolean;
};

function hasTty(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function validatePrivateKey(raw: string): true | string {
  const v = raw.trim();
  if (!v) return "Private key is required";
  if (!v.startsWith("0x") || v.length !== 66) {
    return "Expected 0x followed by 64 hex characters";
  }
  return true;
}

export function isOrbitWalletSetupInteractive(): boolean {
  return hasTty();
}

export async function runOrbitUserWalletSetup(
  options: RunOrbitUserWalletSetupOptions = {},
): Promise<string> {
  if (!hasTty()) {
    throw new Error(
      "Orbit wallet setup requires an interactive terminal. Run: openclaw orbit wallet setup",
    );
  }

  if (hasUserPrivateKey() && !options.replaceExisting) {
    return resolveUserEnvPath();
  }

  const privateKey = await password({
    message: "Enter your wallet private key (PRIVATE_KEY)",
    validate: validatePrivateKey,
  });
  const confirmed = await password({
    message: "Confirm private key",
    validate: (raw) => {
      const check = validatePrivateKey(raw);
      if (check !== true) return check;
      if (raw.trim() !== privateKey.trim()) return "Keys do not match";
      return true;
    },
  });

  return persistUserPrivateKey(confirmed);
}
