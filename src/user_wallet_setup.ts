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

// Strip ANSI escape sequences (including bracketed paste markers \x1b[200~ / \x1b[201~)
// and other non-printable control characters that terminals may inject on paste.
function sanitizeInput(raw: string): string {
  return raw
    .replace(/\x1b\[[0-9;]*[a-zA-Z~]/g, "")
    .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "")
    .trim();
}

function validatePrivateKey(raw: string): true | string {
  const v = sanitizeInput(raw);
  if (!v) return "Private key is required";
  if (!/^0x[0-9a-fA-F]{64}$/.test(v)) {
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
      if (sanitizeInput(raw) !== sanitizeInput(privateKey)) return "Keys do not match";
      return true;
    },
  });

  return persistUserPrivateKey(sanitizeInput(confirmed));
}
