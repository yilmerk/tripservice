// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
const mocks = vi.hoisted(() => ({ mark: vi.fn(), addPlace: vi.fn(), update: vi.fn(), unsubscribe: vi.fn(), updatePlace: vi.fn() }));
vi.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'alice', displayName: 'Ada', email: 'ada@example.com' }, logout: vi.fn() }) }));
vi.mock('../src/services/tripService', () => ({
  subscribeTrips: (_uid: string, next: (trips: unknown[]) => void) => { next([{ id: 'trip-1', title: 'İtalya', destinations: [
    { id: 'rome', city: 'Roma', country: 'İtalya', hotels: [{ name: 'Roma Otel', address: 'Eski otel adresi', location: { lat: 41, lng: 12 } }], airportNotes: 'Express treni', localTransportNotes: 'Temassız ödeme', intercityNotes: 'Floransa treni', places: [
      { id: 'museum', name: 'Vatikan Müzesi', category: 'museum', mustVisit: true, visited: false },
      { id: 'cafe', name: 'Roma Kahve', address: 'Eski mekan adresi', location: { lat: 41, lng: 12 }, category: 'coffee', mustVisit: false, visited: false },
    ] },
    { id: 'florence', city: 'Floransa', country: 'İtalya', places: [] },
  ] }]); return mocks.unsubscribe; },
  markPlaceVisited: mocks.mark, addPlace: mocks.addPlace, updateDestination: mocks.update, updatePlace: mocks.updatePlace,
  createTrip: vi.fn(), addDestination: vi.fn(),
}));
vi.mock('../src/components/ExpensePanel', () => ({ default: () => <div>Seyahat bütçesi</div> }));
import Dashboard from '../src/components/Dashboard';
import { ThemeProvider } from '../src/context/ThemeContext';
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value() { this.setAttribute('open', ''); } },
    close: { configurable: true, value() { this.removeAttribute('open'); } },
  });
});
afterEach(cleanup);
it('shows city guides, filters places, marks visits and switches sidebar routes', async () => {
  const user = userEvent.setup(); render(<ThemeProvider><Dashboard/></ThemeProvider>);
  expect(await screen.findByText('Express treni')).toBeTruthy();
  expect(screen.getByText('Temassız ödeme')).toBeTruthy();
  expect(screen.getByText('Floransa treni')).toBeTruthy();
  expect(screen.getByText('Roma Otel')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Yeme-İçme' }));
  expect(screen.queryByText('Vatikan Müzesi')).toBeNull();
  expect(screen.getByText('Roma Kahve')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Mutlaka Gidilmeli' }));
  expect(screen.queryByText('Roma Kahve')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Vatikan Müzesi: ziyaret edildi olarak işaretle' }));
  expect(mocks.mark).toHaveBeenCalledWith('alice', 'trip-1', 'rome', 'museum', true);
  await user.click(screen.getByRole('button', { name: /02 Floransa/ }));
  expect(screen.getByRole('heading', { name: 'Floransa.' })).toBeTruthy();
  expect(screen.getByText('İlk keşfini ekle.')).toBeTruthy();
  cleanup(); expect(mocks.unsubscribe).toHaveBeenCalled();
});
it('saves a coffee place and fee through the form', async () => {
  const user = userEvent.setup(); render(<ThemeProvider><Dashboard/></ThemeProvider>);
  await user.click(await screen.findByRole('button', { name: 'Mekan ekle' }));
  const dialog = within(screen.getByRole('dialog'));
  await user.type(dialog.getByLabelText('Mekan adı'), 'Yeni Kafe');
  await user.selectOptions(dialog.getByLabelText('Kategori'), 'coffee');
  await user.type(dialog.getByLabelText('Ücret'), '0');
  await user.click(dialog.getByLabelText('Mutlaka gidilmeli'));
  await user.click(dialog.getByRole('button', { name: 'Mekanı rotama ekle' }));
  await waitFor(() => expect(mocks.addPlace).toHaveBeenCalledWith('alice', 'trip-1', 'rome', expect.objectContaining({ name: 'Yeni Kafe', category: 'coffee', fee: { amount: 0, currency: 'EUR' }, mustVisit: true, visited: false })));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});
it('keeps the editor open and displays a save failure', async () => {
  mocks.addPlace.mockRejectedValueOnce(new Error('Kayıt başarısız'));
  const user = userEvent.setup(); render(<ThemeProvider><Dashboard/></ThemeProvider>);
  await user.click(await screen.findByRole('button', { name: 'Mekan ekle' }));
  await user.type(screen.getByLabelText('Mekan adı'), 'Müze');
  await user.click(screen.getByRole('button', { name: 'Mekanı rotama ekle' }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Kayıt başarısız');
  expect(screen.getByRole('dialog')).toBeTruthy();
});

it('opens and saves an existing place without losing its category', async () => {
  const user = userEvent.setup(); render(<ThemeProvider><Dashboard/></ThemeProvider>);
  await user.click(await screen.findByRole('button', { name: 'Roma Kahve: düzenle' }));
  expect((screen.getByLabelText('Mekan adı') as HTMLInputElement).value).toBe('Roma Kahve');
  await user.type(screen.getByLabelText('Neyiyle meşhur?'), 'Espresso');
  await user.click(screen.getByRole('button', { name: 'Değişiklikleri kaydet' }));
  await waitFor(() => expect(mocks.updatePlace).toHaveBeenCalledWith('alice', 'trip-1', 'rome', 'cafe', expect.objectContaining({ category: 'coffee', famousFor: 'Espresso' })));
});

it('shows legacy trips without map panels, address details or directions links', async () => {
  render(<ThemeProvider><Dashboard/></ThemeProvider>);
  expect(await screen.findByText('Roma Otel')).toBeTruthy();
  expect(screen.getByText('Roma Kahve')).toBeTruthy();
  expect(screen.queryByText('Rota haritam')).toBeNull();
  expect(screen.queryByText('Eski otel adresi')).toBeNull();
  expect(screen.queryByText('Eski mekan adresi')).toBeNull();
  expect(screen.queryByRole('link', { name: /yol tarifi/i })).toBeNull();
});
