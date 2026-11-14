// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
const mocks = vi.hoisted(() => ({ initialize: vi.fn() }));
vi.mock('../src/firebase', () => ({ initializeFirebase: mocks.initialize }));
import FirebaseBootstrap from '../src/components/FirebaseBootstrap';
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it('does not mount auth consumers until Firebase has initialized', async () => {
  let resolve!: () => void; mocks.initialize.mockReturnValue(new Promise<void>(done => { resolve = done; }));
  render(<FirebaseBootstrap><div>Giriş formu</div></FirebaseBootstrap>);
  expect(screen.queryByText('Giriş formu')).toBeNull(); expect(screen.getByRole('status')).toBeTruthy();
  await act(async () => resolve()); expect(screen.getByText('Giriş formu')).toBeTruthy();
});
it('handles an initialization failure and retries without a blank or stuck screen', async () => {
  mocks.initialize.mockRejectedValueOnce({ code: 'auth/invalid-api-key' }).mockResolvedValueOnce(undefined);
  const user = userEvent.setup(); render(<FirebaseBootstrap><div>Giriş formu</div></FirebaseBootstrap>);
  expect((await screen.findByRole('alert')).textContent).toContain('auth/invalid-api-key');
  await user.click(screen.getByRole('button', { name: 'Bağlantıyı yeniden dene' }));
  expect(await screen.findByText('Giriş formu')).toBeTruthy();
});
