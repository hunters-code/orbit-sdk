export type OrbitPluginLogger = {
  info?: (message: string) => void;
  warn?: (message: string) => void;
  error?: (message: string) => void;
};

function orbitSdkLogEnabled(): boolean {
  const v = (process.env.ORBIT_SDK_LOG ?? "1").trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "no";
}

export function orbitSdkLog(
  level: "info" | "warn" | "error",
  event: string,
  detail?: Record<string, string | number | boolean | null | undefined>,
  pluginLogger?: OrbitPluginLogger,
): void {
  if (!orbitSdkLogEnabled()) return;
  const payload: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    source: "orbit-sdk",
    event,
    ...detail,
  };
  const line = JSON.stringify(payload);
  const out = `[orbit-sdk] ${line}`;
  console.error(out);
  if (pluginLogger) {
    if (level === "error") pluginLogger.error?.(out);
    else if (level === "warn") pluginLogger.warn?.(out);
    else pluginLogger.info?.(out);
  }
}
