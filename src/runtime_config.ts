import { input, password } from "@inquirer/prompts";

function hasTty(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export async function getEnvOrPrompt(params: {
  envKey: string;
  promptMessage: string;
  secret?: boolean;
  validate?: (value: string) => true | string;
}): Promise<string> {
  const fromEnv = (process.env[params.envKey] ?? "").trim();
  if (fromEnv) return fromEnv;

  if (!hasTty()) {
    throw new Error(`Missing ${params.envKey} and terminal is not interactive`);
  }

  const ask = params.secret ? password : input;
  const value = (await ask({
    message: `${params.promptMessage} (${params.envKey})`,
    validate: (raw: string) => {
      const v = raw.trim();
      if (!v) return `${params.envKey} is required`;
      if (params.validate) return params.validate(v);
      return true;
    }
  })) as string;

  process.env[params.envKey] = value.trim();
  return value.trim();
}

export async function getAnyEnvOrPrompt(params: {
  envKeys: string[];
  promptMessage: string;
  secret?: boolean;
  validate?: (value: string) => true | string;
}): Promise<string> {
  for (const envKey of params.envKeys) {
    const value = (process.env[envKey] ?? "").trim();
    if (value) return value;
  }
  return getEnvOrPrompt({
    envKey: params.envKeys[0],
    promptMessage: params.promptMessage,
    secret: params.secret,
    validate: params.validate
  });
}
