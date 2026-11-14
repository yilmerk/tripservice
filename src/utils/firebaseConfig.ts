export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
}
export function configValue(value: unknown): string {
  if (typeof value !== 'string') return '';
  let result = value.trim();
  // Support values copied from the quoted Firebase web config snippet.
  if (result.endsWith(',')) result = result.slice(0, -1).trim();
  if ((result.startsWith('"') && result.endsWith('"')) || (result.startsWith("'") && result.endsWith("'"))) result = result.slice(1, -1).trim();
  return result;
}
export function isWebApiKey(value: unknown): value is string { return typeof value === 'string' && /^AIza[A-Za-z0-9_-]{35}$/.test(value); }
export async function resolveFirebaseConfig(config: FirebaseWebConfig, fetcher: typeof fetch = globalThis.fetch, timeout = 1800): Promise<FirebaseWebConfig> {
  // Hosting exposes this public configuration on the project's reserved URL.
  // It is independent of the API key currently embedded in the Vite bundle.
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(config.projectId)) return config;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetcher(`https://${config.projectId}.firebaseapp.com/__/firebase/init.json`, {
      credentials: 'omit', redirect: 'error', cache: 'no-store', signal: controller.signal,
    });
    if (!response.ok) return config;
    const remote: unknown = await response.json();
    if (!remote || typeof remote !== 'object') return config;
    const data = remote as Record<string, unknown>;
    // Never accept configuration for another project or a non-Firebase domain.
    if (data.projectId !== config.projectId || data.authDomain !== `${config.projectId}.firebaseapp.com` || !isWebApiKey(data.apiKey)) return config;
    return { ...config, apiKey: data.apiKey };
  } catch {
    // Offline, unprovisioned Hosting or a timeout retains the supplied config.
    return config;
  } finally { clearTimeout(timer); }
}
