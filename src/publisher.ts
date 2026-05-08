import { spawn } from "node:child_process";
import type { OrbitPublisherClient, PublishOptions } from "./types.js";
type PublishPhase = "dry-run" | "publish";

export class OrbitPublishError extends Error {
  readonly phase: PublishPhase;
  readonly exitCode: number | null;

  constructor(phase: PublishPhase, exitCode: number | null) {
    const label = phase === "dry-run" ? "dry-run" : "publish";
    super(`clawhub ${label} failed${exitCode != null ? ` (exit ${exitCode})` : ""}`);
    this.name = "OrbitPublishError";
    this.phase = phase;
    this.exitCode = exitCode;
  }
}

function runNpx(args: string[], cwd: string, phase: PublishPhase): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32"
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new OrbitPublishError(phase, code));
    });
    child.on("error", reject);
  });
}

async function buildPluginRuntime(cwd: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("npx", ["--yes", "tsc", "-p", "tsconfig.build.json"], {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32"
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`build failed (exit ${code ?? "unknown"})`));
    });
    child.on("error", reject);
  });
}

function buildPublishArgs(
  target: string,
  family: "code-plugin" | "bundle-plugin",
  extraArgs: string[] | undefined,
  dryRun: boolean
): string[] {
  const args = ["--yes", "clawhub", "package", "publish", target, "--family", family];
  if (dryRun) args.push("--dry-run");
  if (extraArgs?.length) args.push(...extraArgs);
  return args;
}

export function createPublisher(): OrbitPublisherClient {
  return {
    async publish(options: PublishOptions = {}) {
      const cwd = options.cwd ?? process.cwd();
      const target = options.target ?? ".";
      const family = options.family ?? "code-plugin";
      const extra = options.extraArgs;

      await buildPluginRuntime(cwd);
      await runNpx(buildPublishArgs(target, family, extra, true), cwd, "dry-run");
      await runNpx(buildPublishArgs(target, family, extra, false), cwd, "publish");
    }
  };
}
