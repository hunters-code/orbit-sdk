import { describe, it, expect, afterEach } from "vitest";
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildClawhubPublishArgs } from "../src/publisher.js";

describe("buildClawhubPublishArgs", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("uses clawhub package publish with manifest metadata", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-pub-"));
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "echo-plugin", version: "0.1.0", description: "Echo" }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(tmpDir, "openclaw.plugin.json"),
      JSON.stringify({
        id: "echo-plugin",
        name: "Echo",
        slug: "echo-plugin",
      }),
      "utf8",
    );
    execSync("git init", { cwd: tmpDir });
    execSync("git remote add origin https://github.com/hunters-code/echo-plugin.git", {
      cwd: tmpDir,
    });
    fs.writeFileSync(path.join(tmpDir, "README.md"), "# test\n", "utf8");
    execSync("git add -A", { cwd: tmpDir });
    execSync('git -c user.email=test@test.com -c user.name=test commit -m "init"', {
      cwd: tmpDir,
    });

    const args = buildClawhubPublishArgs(tmpDir, {
      sourceDir: tmpDir,
      family: "code-plugin",
      dryRun: true,
    });

    expect(args[0]).toBe("--yes");
    expect(args.slice(1, 4)).toEqual(["clawhub", "package", "publish"]);
    expect(args).toContain(tmpDir);
    expect(args).toContain("--workdir");
    expect(args).toContain(tmpDir);
    expect(args).toContain("--family");
    expect(args).toContain("code-plugin");
    expect(args).toContain("--name");
    expect(args).toContain("echo-plugin");
    expect(args).toContain("--display-name");
    expect(args).toContain("Echo");
    expect(args).toContain("--version");
    expect(args).toContain("0.1.0");
    expect(args).toContain("--dry-run");
    expect(args).not.toContain("openclaw");
    expect(args).not.toContain("hub");
  });
});
