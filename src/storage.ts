import type { OrbitStorageClient, PluginContextData } from "./types.js";

async function httpJson<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Storage HTTP ${res.status}: ${text || res.statusText}`);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

function requireStorageBaseUrl(): string {
  const base = (process.env.ORBIT_STORAGE_URL ?? "").trim();
  if (!base) {
    throw new Error("Missing ORBIT_STORAGE_URL for non-mock storage");
  }
  return base.replace(/\/+$/, "");
}

export function createStorage(): OrbitStorageClient {
  return {
    async upload(data: PluginContextData): Promise<string> {
      const base = requireStorageBaseUrl();
      const out = await httpJson<{ hash: string }>(`${base}/put`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!out?.hash) {
        throw new Error("Storage: missing hash in response");
      }
      return out.hash;
    },
    async download(hash: string): Promise<PluginContextData> {
      const base = requireStorageBaseUrl();
      return httpJson<PluginContextData>(`${base}/get/${encodeURIComponent(hash)}`, {
        method: "GET",
        headers: { accept: "application/json" }
      });
    }
  };
}
