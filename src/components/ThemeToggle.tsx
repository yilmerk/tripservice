import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';
  return <button type="button" className="theme-toggle inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition-colors duration-200 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 motion-reduce:transition-none" onClick={toggleTheme} aria-pressed={dark} aria-label={`${dark ? 'Gündüz' : 'Gece'} moduna geç`} title={`${dark ? 'Gündüz' : 'Gece'} moduna geç`}><span aria-hidden="true">{dark ? '🌙' : '☀️'}</span><span>{dark ? 'Gece' : 'Gündüz'}</span></button>;
}
