import { setThemePreference, useThemePreference, type ThemePreference } from '../lib/theme';
import { IconMonitor, IconMoon, IconSun } from './Icons';

const NEXT: Record<ThemePreference, ThemePreference> = { system: 'light', light: 'dark', dark: 'system' };
const LABEL: Record<ThemePreference, string> = { system: 'Тема: как в системе', light: 'Тема: светлая', dark: 'Тема: тёмная' };

export function ThemeToggle() {
  const pref = useThemePreference();
  const Icon = pref === 'light' ? IconSun : pref === 'dark' ? IconMoon : IconMonitor;
  return (
    <button
      type="button"
      className="icon-btn"
      onClick={() => setThemePreference(NEXT[pref])}
      aria-label={`${LABEL[pref]}. Переключить`}
      title={LABEL[pref]}
    >
      <Icon />
    </button>
  );
}
