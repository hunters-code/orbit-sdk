import type { Address, Hex } from "viem";
import { computePluginId } from "../registry.js";
import { OrbitPublishError } from "../publisher.js";
import type { PublishCliContext } from "../publish_context.js";
import type { OrbitRegistryClient } from "../types.js";
export type {
  PackageJson,
  PluginManifest,
  PublishCliContext,
} from "../publish_context.js";
export {
  loadPublishCliContext,
  parseWei,
  readJson,
} from "../publish_context.js";

const colorEnabled =
  Boolean(process.stderr.isTTY) &&
  !process.env.NO_COLOR &&
  process.env.FORCE_COLOR !== "0";

export const S = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

export function paint(text: string, open: string): string {
  if (!colorEnabled) return text;
  return `${open}${text}${S.reset}`;
}

export function reportPublishCliFailure(err: unknown): void {
  const line = paint("─".repeat(56), S.dim);
  console.error("");
  console.error(line);

  if (err instanceof OrbitPublishError) {
    const phaseLabel =
      err.phase === "dry-run"
        ? paint("Dry-run", S.cyan + S.bold)
        : paint("Publish", S.cyan + S.bold);
    console.error(`${paint("✖", S.red + S.bold)} ${phaseLabel} ${paint("step failed", S.bold)}`);
    if (err.exitCode != null) {
      console.error(`  ${paint("Exit code:", S.dim)} ${paint(String(err.exitCode), S.yellow)}`);
    }
  } else if (err instanceof Error) {
    console.error(`${paint("✖", S.red + S.bold)} ${paint(err.message, S.bold)}`);
  } else {
    console.error(`${paint("✖", S.red + S.bold)} ${paint(String(err), S.bold)}`);
  }

  console.error("");
  console.error(paint("Typical fixes:", S.yellow + S.bold));
  console.error(`  ${paint("•", S.dim)} ${paint("clawhub login", S.green)} ${paint("(interactive)", S.dim)}`);
  console.error(
    `  ${paint("•", S.dim)} ${paint("OPENCLAW_CLAWHUB_TOKEN", S.green)} ${paint("or", S.dim)} ${paint("CLAWHUB_TOKEN", S.green)} ${paint("in env", S.dim)}`,
  );
  console.error(`  ${paint("•", S.dim)} ${paint("clawhub login --token", S.green)} ${paint("<token>", S.dim)}`);
  console.error(line);
  console.error("");
}

function readPluginKeyEnv(): string {
  return (
    process.env.PLUGIN_KEY ??
    process.env.OPENCLAW_PLUGIN_KEY ??
    process.env.ORBIT_PLUGIN_ID ??
    ""
  ).trim();
}

function parsePluginKeyEnv(raw: string): Hex {
  if (!raw.startsWith("0x") || raw.length !== 66) {
    throw new Error("Invalid PLUGIN_KEY (expected 0x + 64 hex chars)");
  }
  return raw as Hex;
}

export function resolvePluginKeyOptional(): Hex | null {
  const v = readPluginKeyEnv();
  if (!v) return null;
  return parsePluginKeyEnv(v);
}

export function resolvePluginKey(): Hex {
  const v = readPluginKeyEnv();
  if (!v) throw new Error("Missing PLUGIN_KEY for plugin update");
  return parsePluginKeyEnv(v);
}

export async function resolveRegistryPluginId(
  registry: OrbitRegistryClient,
  ctx: PublishCliContext,
): Promise<Hex> {
  const fromEnv = resolvePluginKeyOptional();
  if (fromEnv) return fromEnv;
  const owner = await registry.getSignerAddress();
  return computePluginId(ctx.displayName, ctx.version, owner);
}
