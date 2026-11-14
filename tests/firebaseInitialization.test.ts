import { afterEach, beforeEach, expect, it, vi } from 'vitest';
let current: typeof import('../src/firebase') | undefined;
const original = `AIza${'a'.repeat(35)}`;
const official = `AIza${'b'.repeat(35)}`;
beforeEach(() => {
  vi.resetModules(); current = undefined;
  vi.stubEnv('VITE_FIREBASE_API_KEY', original);
  vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'rota-project');
  vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'rota-project.firebaseapp.com');
  vi.stubEnv('VITE_FIREBASE_APP_ID', '1:123:web:test-app');
});
afterEach(async () => {
  if (current?.app) { const { deleteApp } = await import('firebase/app'); await deleteApp(current.app); }
  vi.unstubAllEnvs(); vi.unstubAllGlobals();
});
it('initializes the real Auth and Firestore SDKs with the verified official key, once', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ projectId: 'rota-project', authDomain: 'rota-project.firebaseapp.com', apiKey: official }) });
  vi.stubGlobal('fetch', fetcher);
  current = await import('../src/firebase');
  expect(current.auth).toBeNull();
  const first = current.initializeFirebase(); const second = current.initializeFirebase();
  expect(first).toBe(second); await first;
  expect(current.app?.options.apiKey).toBe(official);
  expect(current.auth?.config.apiKey).toBe(official);
  expect(current.app?.options.projectId).toBe('rota-project'); expect(current.db).toBeTruthy();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('retries a malformed key after the authoritative endpoint becomes available', async () => {
  vi.stubEnv('VITE_FIREBASE_API_KEY', 'invalid');
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true, json: async () => ({ projectId: 'rota-project', authDomain: 'rota-project.firebaseapp.com', apiKey: official }) });
  vi.stubGlobal('fetch', fetcher); current = await import('../src/firebase');
  await expect(current.initializeFirebase()).rejects.toMatchObject({ code: 'auth/invalid-api-key' });
  expect(current.auth).toBeNull();
  await current.initializeFirebase(); expect(current.auth?.config.apiKey).toBe(official);
});
it('keeps the welcome screen available without a configured project', async () => {
  vi.stubEnv('VITE_FIREBASE_PROJECT_ID', '');
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher); current = await import('../src/firebase');
  await current.initializeFirebase(); expect(current.app).toBeNull(); expect(fetcher).not.toHaveBeenCalled();
});
