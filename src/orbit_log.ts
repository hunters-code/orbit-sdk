function orbitSdkLogEnabled(): boolean {
  const v = (process.env.ORBIT_SDK_LOG ?? "1").trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "no";
}

export function orbitSdkLog(
  level: "info" | "warn" | "error",
  event: string,
  detail?: Record<string, string | number | boolean | null | undefined>,
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
  if (level === "error") console.error(out);
  else console.error(out);
}
