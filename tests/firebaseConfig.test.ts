import { expect, it, vi } from 'vitest';
import { configValue, resolveFirebaseConfig, type FirebaseWebConfig } from '../src/utils/firebaseConfig';
const original: FirebaseWebConfig = { apiKey: `AIza${'x'.repeat(35)}`, projectId: 'rota-project', authDomain: 'rota-project.firebaseapp.com', appId: '1:123:web:original-app' };
const recovered = `AIza${'y'.repeat(35)}`;
function response(data: unknown, ok = true) { return { ok, json: async () => data } as Response; }
it('repairs the API key from the expected project public Firebase config while retaining the app identity', async () => {
  const fetcher = vi.fn().mockResolvedValue(response({ projectId: original.projectId, authDomain: original.authDomain, apiKey: recovered, appId: 'another-web-app' }));
  expect(await resolveFirebaseConfig(original, fetcher)).toEqual({ ...original, apiKey: recovered });
  expect(fetcher).toHaveBeenCalledWith('https://rota-project.firebaseapp.com/__/firebase/init.json', expect.objectContaining({ credentials: 'omit', redirect: 'error', cache: 'no-store' }));
  expect(fetcher.mock.calls[0][0]).not.toContain(original.apiKey);
});
it.each([
  { projectId: 'other-project', authDomain: 'other-project.firebaseapp.com', apiKey: recovered },
  { projectId: 'rota-project', authDomain: 'example.com', apiKey: recovered },
  { projectId: 'rota-project', authDomain: 'rota-project.firebaseapp.com', apiKey: 'invalid' },
  null,
])('rejects cross-project or unverified public configuration', async data => {
  const fetcher = vi.fn().mockResolvedValue(response(data));
  expect(await resolveFirebaseConfig(original, fetcher)).toEqual(original);
});
it('retains configured values on network failure, unavailable Hosting and invalid JSON', async () => {
  for (const fetcher of [vi.fn().mockRejectedValue(new Error('offline')), vi.fn().mockResolvedValue(response({}, false)), vi.fn().mockResolvedValue({ ok: true, json: async () => { throw new Error('invalid JSON'); } })]) {
    expect(await resolveFirebaseConfig(original, fetcher)).toEqual(original);
  }
});
it('bounds a slow request with an abort signal', async () => {
  const fetcher = vi.fn((_url: unknown, options: RequestInit) => new Promise<Response>((_resolve, reject) => options.signal?.addEventListener('abort', () => reject(new Error('aborted')))));
  expect(await resolveFirebaseConfig(original, fetcher as typeof fetch, 5)).toEqual(original);
});
it('does not construct a URL from an invalid project ID', async () => {
  const fetcher = vi.fn(); const config = { ...original, projectId: 'attacker.example/path' };
  expect(await resolveFirebaseConfig(config, fetcher)).toEqual(config); expect(fetcher).not.toHaveBeenCalled();
});
it('cleans copied environment values without altering real key characters', () => {
  expect(configValue(`  "${original.apiKey}",\n`)).toBe(original.apiKey);
  expect(configValue(`'${original.appId}'`)).toBe(original.appId);
  expect(configValue(undefined)).toBe('');
});
