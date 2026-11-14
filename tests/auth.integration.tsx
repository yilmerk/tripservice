// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createUserWithEmailAndPassword, signOut, connectAuthEmulator } from 'firebase/auth';
import type { ComponentType, ReactNode } from 'react';

vi.mock('../src/components/Dashboard', async () => {
  const { useAuth } = await import('../src/context/AuthContext');
  return { default: () => { const { logout } = useAuth(); return <div><h1>Oturum açıldı</h1><button onClick={() => void logout()}>Çıkış yap</button></div>; } };
});
let firebase: typeof import('../src/firebase');
let App: ComponentType;
let AuthProvider: ComponentType<{ children: ReactNode }>;
let ThemeProvider: ComponentType<{ children: ReactNode }>;
let FirebaseBootstrap: ComponentType<{ children: ReactNode }>;
const officialKey = `AIza${'b'.repeat(35)}`;
const email = `test-${Date.now()}@rota.example`;
const password = 'Sample password 123!';
beforeAll(async () => {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (!host || !/^(127\.0\.0\.1|localhost):\d+$/.test(host)) throw new Error('This suite requires a local Firebase Auth emulator.');
  vi.stubEnv('VITE_FIREBASE_API_KEY', 'invalid-embedded-key');
  vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'demo-rota');
  vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'demo-rota.firebaseapp.com');
  vi.stubEnv('VITE_FIREBASE_APP_ID', '1:123:web:auth-test');
  const nativeFetch = globalThis.fetch;
  vi.stubGlobal('fetch', async (resource: RequestInfo | URL, options?: RequestInit) => {
    const url = typeof resource === 'string' ? resource : resource instanceof URL ? resource.href : resource.url;
    if (url === 'https://demo-rota.firebaseapp.com/__/firebase/init.json') {
      return new Response(JSON.stringify({ apiKey: officialKey, projectId: 'demo-rota', authDomain: 'demo-rota.firebaseapp.com' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (!url.startsWith(`http://${host}/`)) throw new Error('External requests are not permitted by this test.');
    return nativeFetch(resource, options);
  });
  firebase = await import('../src/firebase');
  await firebase.initializeFirebase();
  connectAuthEmulator(firebase.auth!, `http://${host}`, { disableWarnings: true });
  App = (await import('../src/App')).default;
  AuthProvider = (await import('../src/context/AuthContext')).AuthProvider;
  ThemeProvider = (await import('../src/context/ThemeContext')).ThemeProvider;
  FirebaseBootstrap = (await import('../src/components/FirebaseBootstrap')).default;
  await createUserWithEmailAndPassword(firebase.auth!, email, password);
});
beforeEach(async () => { await signOut(firebase.auth!); });
afterEach(cleanup);
afterAll(async () => {
  if (firebase?.auth) await signOut(firebase.auth);
  if (firebase?.app) { const { deleteApp } = await import('firebase/app'); await deleteApp(firebase.app); }
  vi.unstubAllEnvs(); vi.unstubAllGlobals();
});
function renderLogin() { return render(<ThemeProvider><FirebaseBootstrap><AuthProvider><App/></AuthProvider></FirebaseBootstrap></ThemeProvider>); }
it('repairs the embedded key and logs in/out through the real Firebase SDK and observer', async () => {
  expect(firebase.auth?.config.apiKey).toBe(officialKey);
  expect(firebase.app?.options.projectId).toBe('demo-rota');
  const user = userEvent.setup(); renderLogin();
  await user.type(await screen.findByLabelText('E-posta adresin'), email); await user.type(screen.getByLabelText('Şifren'), password);
  await user.click(screen.getByRole('button', { name: 'Yolculuğa devam et' }));
  expect(await screen.findByRole('heading', { name: 'Oturum açıldı' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Çıkış yap' }));
  expect(await screen.findByLabelText('E-posta adresin')).toBeTruthy();
});
it('shows the actual credential error then permits a successful retry', async () => {
  const user = userEvent.setup(); renderLogin();
  await user.type(await screen.findByLabelText('E-posta adresin'), email); await user.type(screen.getByLabelText('Şifren'), 'wrong-password');
  await user.click(screen.getByRole('button', { name: 'Yolculuğa devam et' }));
  expect((await screen.findByRole('alert')).textContent).toContain('E-posta veya şifre hatalı');
  await user.clear(screen.getByLabelText('Şifren')); await user.type(screen.getByLabelText('Şifren'), password);
  await user.click(screen.getByRole('button', { name: 'Yolculuğa devam et' }));
  expect(await screen.findByRole('heading', { name: 'Oturum açıldı' })).toBeTruthy();
});
it('registers a new email/password account and enters the dashboard', async () => {
  const user = userEvent.setup(); renderLogin();
  await user.click(await screen.findByRole('tab', { name: 'Hesap oluştur' }));
  await user.type(screen.getByLabelText('Adın ve soyadın'), 'Test Gezgin');
  await user.type(screen.getByLabelText('E-posta adresin'), `new-${Date.now()}@rota.example`); await user.type(screen.getByLabelText('Şifren'), password);
  await user.click(screen.getByRole('button', { name: 'Hesabımı oluştur' }));
  expect(await screen.findByRole('heading', { name: 'Oturum açıldı' })).toBeTruthy();
});
