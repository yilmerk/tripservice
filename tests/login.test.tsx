// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../src/context/ThemeContext';
const mocks = vi.hoisted(() => ({ login: vi.fn(), google: vi.fn(), register: vi.fn() }));
vi.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ user: null, loading: false, error: null, signInWithEmail: mocks.login, signInWithGoogle: mocks.google, register: mocks.register }) }));
vi.mock('../src/components/Dashboard', () => ({ default: () => <div>Panel</div> }));
import App from '../src/App';
beforeEach(() => { vi.resetAllMocks(); }); afterEach(() => { cleanup(); vi.unstubAllEnvs(); });
it('shows the previously hidden Firebase reason and code, then enables retry', async () => {
  mocks.login.mockRejectedValueOnce({ code: 'auth/configuration-not-found', message: 'raw backend details' });
  const user = userEvent.setup(); render(<ThemeProvider><App/></ThemeProvider>);
  await user.type(screen.getByLabelText('E-posta adresin'), 'guest@example.com');
  await user.type(screen.getByLabelText('Şifren'), ' sample password ');
  await user.click(screen.getByRole('button', { name: 'Yolculuğa devam et' }));
  const error = await screen.findByRole('alert');
  expect(error.textContent).toContain('Authentication kurulumu'); expect(error.textContent).toContain('auth/configuration-not-found');
  expect(error.textContent).not.toContain('raw backend');
  expect(mocks.login).toHaveBeenCalledWith('guest@example.com', ' sample password ');
  await user.click(screen.getByRole('button', { name: 'Yolculuğa devam et' }));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
});
it('recognizes legacy wrong-password responses instead of the generic fallback', async () => {
  mocks.login.mockRejectedValueOnce({ code: 'auth/wrong-password' });
  const user = userEvent.setup(); render(<ThemeProvider><App/></ThemeProvider>);
  await user.type(screen.getByLabelText('E-posta adresin'), 'guest@example.com'); await user.type(screen.getByLabelText('Şifren'), 'incorrect');
  await user.click(screen.getByRole('button', { name: 'Yolculuğa devam et' }));
  expect((await screen.findByRole('alert')).textContent).toContain('E-posta veya şifre hatalı');
});

it('identifies the configured project on setup errors without exposing its API key', async () => {
  vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'rota-project'); vi.stubEnv('VITE_FIREBASE_API_KEY', 'never-display-this-key');
  mocks.login.mockRejectedValueOnce({ code: 'auth/invalid-api-key' });
  const user = userEvent.setup(); render(<ThemeProvider><App/></ThemeProvider>);
  await user.type(screen.getByLabelText('E-posta adresin'), 'guest@example.com'); await user.type(screen.getByLabelText('Şifren'), 'sample-password');
  await user.click(screen.getByRole('button', { name: 'Yolculuğa devam et' }));
  const error = await screen.findByRole('alert'); expect(error.textContent).toContain('rota-project'); expect(error.textContent).not.toContain('never-display-this-key');
});
