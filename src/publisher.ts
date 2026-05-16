import fs from "node:fs";
import path from "node:path";
import { execSync, spawn } from "node:child_process";
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

function ensureTsconfigBuild(cwd: string): void {
  const buildConfigPath = path.join(cwd, "tsconfig.build.json");
  if (fs.existsSync(buildConfigPath)) return;

  const config = {
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "Bundler",
      strict: true,
      skipLibCheck: true,
      outDir: "dist",
      rootDir: ".",
      declaration: false,
      sourceMap: false,
      noEmit: false,
    },
    include: ["index.ts", "src/**/*.ts"],
  };
  fs.writeFileSync(buildConfigPath, JSON.stringify(config, null, 2) + "\n", "utf8");
  console.log(`  created tsconfig.build.json`);
}

function ensurePluginManifest(cwd: string): void {
  const manifestPath = path.join(cwd, "openclaw.plugin.json");
  if (!fs.existsSync(manifestPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8"));
      const manifest = {
        id: pkg.name || "unknown-plugin",
        name: pkg.name || "unknown-plugin",
        description: pkg.description || "",
        activation: { onStartup: true },
        configSchema: { type: "object", additionalProperties: false, properties: {} },
      };
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
      console.log(`  created openclaw.plugin.json`);
    } catch {}
  }
  const distManifest = path.join(cwd, "dist", "openclaw.plugin.json");
  if (fs.existsSync(manifestPath) && fs.existsSync(path.join(cwd, "dist")) && !fs.existsSync(distManifest)) {
    fs.copyFileSync(manifestPath, distManifest);
  }
}

async function buildPluginRuntime(cwd: string): Promise<void> {
  ensureTsconfigBuild(cwd);
  ensurePluginManifest(cwd);
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

function normalizeGitRemote(raw: string): string | null {
  // Standard HTTPS: https://github.com/user/repo(.git)
  const httpsMatch = raw.match(/^https:\/\/github\.com\/[^/]+\/[^/]+?(\.git)?$/);
  if (httpsMatch) return raw.replace(/\.git$/, "");

  // SSH (standard or alias): git@<host-containing-"github">:user/repo(.git)
  // Handles git@github.com:user/repo and aliases like git@github-personal:user/repo
  const sshMatch = raw.match(/^git@[^:]*github[^:]*:([^/]+\/[^/]+?)(\.git)?$/i);
  if (sshMatch) return `https://github.com/${sshMatch[1]}`;

  return null;
}

function resolveGitInfo(cwd: string): { repo: string; commit: string } | null {
  try {
    const raw = execSync("git remote get-url origin", { cwd, encoding: "utf8" }).trim();
    const repo = normalizeGitRemote(raw);
    if (!repo) return null;
    const commit = execSync("git rev-parse HEAD", { cwd, encoding: "utf8" }).trim();
    if (repo && commit) return { repo, commit };
  } catch {}
  return null;
}

function resolveVersion(cwd: string): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8"));
    return pkg.version || "0.0.0";
  } catch {}
  return "0.0.0";
}

function buildPublishArgs(
  target: string,
  family: "code-plugin" | "bundle-plugin",
  extraArgs: string[] | undefined,
  dryRun: boolean,
  cwd: string
): string[] {
  const args = ["--yes", "clawhub", "package", "publish", target, "--family", family];
  if (dryRun) args.push("--dry-run");
  const git = resolveGitInfo(cwd);
  if (git) {
    args.push("--source-repo", git.repo, "--source-commit", git.commit);
  }
  args.push("--version", resolveVersion(cwd));
  if (extraArgs?.length) args.push(...extraArgs);
  return args;
}

export function createPublisher(): OrbitPublisherClient {
  return {
    async publish(options: PublishOptions = {}) {
      const cwd = options.cwd ?? process.cwd();
      const target = options.target ?? cwd;
      const family = options.family ?? "code-plugin";
      const extra = options.extraArgs;

      await buildPluginRuntime(cwd);
      await runNpx(buildPublishArgs(path.resolve(cwd, target), family, extra, true, cwd), cwd, "dry-run");
      await runNpx(buildPublishArgs(path.resolve(cwd, target), family, extra, false, cwd), cwd, "publish");
    }
  };
}
