// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { deleteApp } from 'firebase/app';

vi.mock('../src/firebase', async () => {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (!host || !/^(127\.0\.0\.1|localhost):\d+$/.test(host)) throw new Error('This suite requires a local Firebase Auth emulator.');
  const { initializeApp } = await import('firebase/app');
  const { getAuth, connectAuthEmulator, GoogleAuthProvider } = await import('firebase/auth');
  const app = initializeApp({ apiKey: 'demo-api-key', projectId: 'demo-rota', authDomain: 'demo-rota.firebaseapp.com' }, 'auth-integration');
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${host}`, { disableWarnings: true });
  return { app, auth, db: null, googleProvider: new GoogleAuthProvider(), initializeFirebase: async () => undefined };
});
vi.mock('../src/components/Dashboard', async () => {
  const { useAuth } = await import('../src/context/AuthContext');
  return { default: () => { const { logout } = useAuth(); return <div><h1>Oturum açıldı</h1><button onClick={() => void logout()}>Çıkış yap</button></div>; } };
});
import { app, auth } from '../src/firebase';
import App from '../src/App';
import FirebaseBootstrap from '../src/components/FirebaseBootstrap';
import { AuthProvider } from '../src/context/AuthContext';
import { ThemeProvider } from '../src/context/ThemeContext';
const email = `test-${Date.now()}@rota.example`;
const password = 'Sample password 123!';
beforeAll(async () => { await createUserWithEmailAndPassword(auth!, email, password); });
beforeEach(async () => { await signOut(auth!); });
afterEach(cleanup);
afterAll(async () => { await signOut(auth!); await deleteApp(app!); });
function renderLogin() { return render(<ThemeProvider><FirebaseBootstrap><AuthProvider><App/></AuthProvider></FirebaseBootstrap></ThemeProvider>); }
it('logs in and out through the real Firebase SDK and auth observer', async () => {
  const user = userEvent.setup(); renderLogin();
  await user.type(await screen.findByLabelText('E-posta adresin'), email);
  await user.type(screen.getByLabelText('Şifren'), password);
  await user.click(screen.getByRole('button', { name: 'Yolculuğa devam et' }));
  expect(await screen.findByRole('heading', { name: 'Oturum açıldı' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Çıkış yap' }));
  expect(await screen.findByLabelText('E-posta adresin')).toBeTruthy();
});
it('shows the actual credential error then permits a successful retry', async () => {
  const user = userEvent.setup(); renderLogin();
  await user.type(await screen.findByLabelText('E-posta adresin'), email);
  await user.type(screen.getByLabelText('Şifren'), 'wrong-password');
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
  await user.type(screen.getByLabelText('E-posta adresin'), `new-${Date.now()}@rota.example`);
  await user.type(screen.getByLabelText('Şifren'), password);
  await user.click(screen.getByRole('button', { name: 'Hesabımı oluştur' }));
  expect(await screen.findByRole('heading', { name: 'Oturum açıldı' })).toBeTruthy();
});
