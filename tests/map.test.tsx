// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
vi.mock('@react-google-maps/api', () => ({
  useJsApiLoader: () => ({ isLoaded: true, loadError: undefined }),
  GoogleMap: ({ children }: { children: ReactNode }) => <div data-testid="google-map">{children}</div>,
  MarkerF: ({ title, onClick }: { title: string; onClick: () => void }) => <button onClick={onClick}>{title}</button>,
  InfoWindowF: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
import CityMap from '../src/components/CityMap';
import { ThemeProvider } from '../src/context/ThemeContext';
const city = { id: 'rome', city: 'Roma', country: 'İtalya', hotels: [{ name: 'Otel', location: { lat: 41, lng: 12 }, address: 'Otel adresi' }], places: [{ id: 'museum', name: 'Müze', category: 'museum' as const, location: { lat: 42, lng: 13 }, mustVisit: true, visited: false, notes: 'Pazartesi kapalı', fee: { amount: 10, currency: 'EUR' } }] };
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });
it('opens hotel and place details with directions to the clicked pin', async () => {
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key');
  const user = userEvent.setup(); render(<ThemeProvider><CityMap destination={city}/></ThemeProvider>);
  await user.click(screen.getByRole('button', { name: 'Otel' }));
  expect(screen.getByText('Otel adresi')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Google Maps Yol Tarifi Al' }).getAttribute('href')).toContain('41%2C12');
  await user.click(screen.getByRole('button', { name: 'Müze' }));
  expect(screen.getByText('Pazartesi kapalı')).toBeTruthy();
  expect(screen.getByText(/10 EUR/)).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Google Maps Yol Tarifi Al' }).getAttribute('href')).toContain('42%2C13');
});
it('displays setup state without attempting to show a map when the key is missing', () => {
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '');
  render(<ThemeProvider><CityMap destination={city}/></ThemeProvider>);
  expect(screen.getByText('Rotan haritada hayat bulsun.')).toBeTruthy();
  expect(screen.queryByTestId('google-map')).toBeNull();
});
