// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
const mocks = vi.hoisted(() => ({ geocode: vi.fn(), suggest: vi.fn(), fields: vi.fn(), save: vi.fn(), loader: vi.fn(() => ({ isLoaded: true, loadError: undefined })) }));
vi.mock('@react-google-maps/api', () => ({
  useJsApiLoader: mocks.loader,
  GoogleMap: ({ children, onClick }: { children: ReactNode; onClick?: (event: unknown) => void }) => <div data-testid="google-map"><button type="button" onClick={() => onClick?.({ latLng: { toJSON: () => ({ lat: 41, lng: 29 }) } })}>Haritada konum seç</button>{children}</div>,
  MarkerF: ({ position }: { position: { lat: number; lng: number } }) => <div data-testid="marker">{position.lat},{position.lng}</div>,
  InfoWindowF: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
import { ThemeProvider } from '../src/context/ThemeContext';
import { DestinationForm, PlaceForm } from '../src/components/TripForms';
import CityMap from '../src/components/CityMap';
function placeForm() { return render(<ThemeProvider><PlaceForm busy={false} onSave={mocks.save}/></ThemeProvider>); }
function input(label: string) { return screen.getByLabelText(label) as HTMLInputElement; }
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key');
  mocks.geocode.mockResolvedValue({ results: [{ formatted_address: 'Tam açık adres, İstanbul' }] });
  mocks.suggest.mockResolvedValue({ suggestions: [{ placePrediction: { placeId: 'selected', text: { toString: () => 'Seçilen Otel' }, toPlace: () => ({ fetchFields: mocks.fields, location: { toJSON: () => ({ lat: 48, lng: 2 }) }, formattedAddress: 'Paris açık adres' }) } }] });
  mocks.fields.mockResolvedValue({});
  vi.stubGlobal('google', { maps: {
    Geocoder: class { geocode = mocks.geocode; },
    places: { AutocompleteSessionToken: class {}, AutocompleteSuggestion: { fetchAutocompleteSuggestions: mocks.suggest } },
  } });
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it('fills address and coordinates after a map click and submits them', async () => {
  const user = userEvent.setup(); placeForm();
  await user.type(input('Mekan adı'), 'İstanbul Kafe');
  await user.click(screen.getByRole('button', { name: 'Haritada konum seç' }));
  await waitFor(() => expect(input('Adres').value).toBe('Tam açık adres, İstanbul'));
  expect(input('Enlem').value).toBe('41'); expect(input('Boylam').value).toBe('29');
  await user.click(screen.getByRole('button', { name: 'Mekanı rotama ekle' }));
  expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ address: 'Tam açık adres, İstanbul', location: { lat: 41, lng: 29 } }));
});
it('selects an autocomplete result with keyboard and saves hotel coordinates', async () => {
  const user = userEvent.setup(); render(<ThemeProvider><DestinationForm busy={false} onSave={mocks.save}/></ThemeProvider>);
  await user.type(input('Şehir'), 'Paris'); await user.type(input('Ülke'), 'Fransa'); await user.type(input('Otel adı'), 'Paris Otel');
  await user.type(screen.getByRole('combobox', { name: 'Haritada yer ara' }), 'Paris');
  await screen.findByRole('option', { name: 'Seçilen Otel' });
  await user.keyboard('{ArrowDown}{Enter}');
  await waitFor(() => expect(input('Adres').value).toBe('Paris açık adres'));
  expect(input('Enlem').value).toBe('48'); expect(input('Boylam').value).toBe('2');
  await user.click(screen.getByRole('button', { name: 'Şehri kaydet' }));
  expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ hotels: [expect.objectContaining({ address: 'Paris açık adres', location: { lat: 48, lng: 2 } })] }));
  expect(mocks.fields).toHaveBeenCalledWith({ fields: ['location', 'formattedAddress'] });
});
it('blocks save during reverse geocoding and clears an old address before resolving', async () => {
  let resolve!: (value: unknown) => void;
  mocks.geocode.mockReturnValue(new Promise(value => { resolve = value; }));
  const user = userEvent.setup(); placeForm();
  await user.type(input('Adres'), 'Eski adres');
  await user.click(screen.getByRole('button', { name: 'Haritada konum seç' }));
  expect(input('Adres').value).toBe('');
  expect((screen.getByRole('button', { name: 'Konum alınıyor…' }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => resolve({ results: [{ formatted_address: 'Yeni adres' }] }));
  expect(input('Adres').value).toBe('Yeni adres');
});
it('retains picked coordinates after a geocoding failure and lets the user enter an address', async () => {
  mocks.geocode.mockRejectedValue(new Error('denied'));
  const user = userEvent.setup(); placeForm();
  await user.click(screen.getByRole('button', { name: 'Haritada konum seç' }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Konum seçildi, ancak adres alınamadı. Adresi elle girebilirsin.');
  expect(input('Enlem').value).toBe('41');
  await user.type(input('Adres'), 'Elle adres'); expect(input('Adres').value).toBe('Elle adres');
});
it('initializes the map selection and famousFor from an existing place', () => {
  render(<ThemeProvider><PlaceForm busy={false} place={{ id: 'old', name: 'Kafe', category: 'coffee', visited: true, mustVisit: false, location: { lat: 48, lng: 2 }, address: 'Paris', famousFor: 'Espresso' }} onSave={mocks.save}/></ThemeProvider>);
  expect(input('Adres').value).toBe('Paris'); expect(screen.getByTestId('marker').textContent).toBe('48,2');
  expect(input('Neyiyle meşhur?').value).toBe('Espresso');
});
it('ignores an obsolete autocomplete response after the query changes', async () => {
  let resolve!: (value: unknown) => void;
  mocks.suggest.mockReturnValueOnce(new Promise(value => { resolve = value; }));
  const user = userEvent.setup(); placeForm();
  await user.type(screen.getByRole('combobox', { name: 'Haritada yer ara' }), 'Roma');
  await waitFor(() => expect(mocks.suggest).toHaveBeenCalledTimes(1));
  await user.clear(screen.getByRole('combobox', { name: 'Haritada yer ara' }));
  await act(async () => resolve({ suggestions: [{ placePrediction: { placeId: 'old', text: { toString: () => 'Eski sonuç' } } }] }));
  expect(screen.queryByRole('option', { name: 'Eski sonuç' })).toBeNull();
});
it('uses identical Places loader configuration in the city map and the picker', () => {
  render(<ThemeProvider><PlaceForm busy={false} onSave={mocks.save}/><CityMap destination={{ id: 'city', city: 'Roma', country: 'İtalya', places: [] }}/></ThemeProvider>);
  const calls = mocks.loader.mock.calls as unknown as [Record<string, unknown>][];
  expect(calls.length).toBeGreaterThanOrEqual(2);
  for (const [options] of calls) {
    expect(options.id).toBe('rota-google-map'); expect(options.libraries).toEqual(['places']); expect(options.libraries).toBe(calls[0][0].libraries);
  }
});
it('preserves manual entry without a Maps key', async () => {
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '');
  const user = userEvent.setup(); placeForm();
  expect(screen.queryByTestId('google-map')).toBeNull();
  await user.type(input('Adres'), 'Elle adres'); await user.type(input('Enlem'), '41'); await user.type(input('Boylam'), '29');
  expect(input('Adres').value).toBe('Elle adres');
});
