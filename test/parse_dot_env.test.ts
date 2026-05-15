import { describe, it, expect } from "vitest";
import { parseDotEnv } from "../src/runtime_config.js";

describe("parseDotEnv", () => {
  it("parses basic KEY=value pairs", () => {
    expect(parseDotEnv("FOO=bar\nBAZ=qux")).toEqual({ FOO: "bar", BAZ: "qux" });
  });

  it("ignores empty lines and comments", () => {
    expect(
      parseDotEnv(`
# comment
ALPHA=1

BETA=two
`)
    ).toEqual({ ALPHA: "1", BETA: "two" });
  });

  it("strips export prefix", () => {
    expect(parseDotEnv("export PRIVATE_KEY=0xabc")).toEqual({ PRIVATE_KEY: "0xabc" });
  });

  it("unwraps double-quoted values", () => {
    expect(parseDotEnv('X="hello world"')).toEqual({ X: "hello world" });
  });

  it("unwraps single-quoted values", () => {
    expect(parseDotEnv("Y='a=b'")).toEqual({ Y: "a=b" });
  });

  it("last duplicate key wins", () => {
    expect(parseDotEnv("K=1\nK=2")).toEqual({ K: "2" });
  });

  it("skips lines without equals or empty key", () => {
    expect(parseDotEnv("noequals\n=noval\nOK=1")).toEqual({ OK: "1" });
  });
});
