// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, THEME_STORAGE_KEY } from '../src/context/ThemeContext';
import ThemeToggle from '../src/components/ThemeToggle';

let media: EventTarget & { matches: boolean };
function setSystemDark(dark: boolean) {
  media.matches = dark;
  act(() => media.dispatchEvent(Object.assign(new Event('change'), { matches: dark })));
}
function renderToggle() { return render(<ThemeProvider><ThemeToggle/></ThemeProvider>); }
beforeEach(() => {
  localStorage.clear(); document.documentElement.classList.remove('dark');
  media = Object.assign(new EventTarget(), { matches: false });
  vi.stubGlobal('matchMedia', vi.fn(() => media));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.documentElement.classList.remove('dark'); });
describe('theme preference', () => {
  it('uses the system theme without persisting a preference, then follows system changes', () => {
    media.matches = true;
    renderToggle();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(screen.getByRole('button', { name: 'Gündüz moduna geç' }).textContent).toContain('Gece');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    setSystemDark(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
  });
  it('honors a saved light choice even when the system is dark', () => {
    media.matches = true; localStorage.setItem(THEME_STORAGE_KEY, 'light');
    renderToggle();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
  it('toggles, persists, ignores system changes after a choice and restores on remount', async () => {
    const user = userEvent.setup(); const view = renderToggle();
    await user.click(screen.getByRole('button', { name: 'Gece moduna geç' }));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    setSystemDark(false);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    view.unmount(); renderToggle();
    expect(screen.getByRole('button', { name: 'Gündüz moduna geç' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Gündüz moduna geç' }));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
  it('treats an invalid saved value as a system preference', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'invalid'); media.matches = true;
    renderToggle(); expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
  it('works when storage access is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const user = userEvent.setup(); renderToggle();
    await user.click(screen.getByRole('button', { name: 'Gece moduna geç' }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
  it('syncs other tabs and returns to the system when their stored preference is cleared', () => {
    renderToggle();
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: THEME_STORAGE_KEY, newValue: 'dark' })));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: null, newValue: null })));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
  it('removes listeners on unmount', () => {
    const removeMedia = vi.spyOn(media, 'removeEventListener');
    const removeWindow = vi.spyOn(window, 'removeEventListener');
    const view = renderToggle(); view.unmount();
    expect(removeMedia).toHaveBeenCalledWith('change', expect.any(Function));
    expect(removeWindow).toHaveBeenCalledWith('storage', expect.any(Function));
  });
});
describe('pre-render initialization', () => {
  const initialize = () => new Function(readFileSync('public/theme-init.js', 'utf8'))();
  it('applies saved dark before React mounts and lets saved light override the OS', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark'); initialize();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    media.matches = true; localStorage.setItem(THEME_STORAGE_KEY, 'light'); initialize();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
  it('uses the OS theme even with unavailable storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    media.matches = true; initialize();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
