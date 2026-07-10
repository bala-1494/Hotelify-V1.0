// Theme presets. These mirror the rows seeded in supabase/migrations/0001_foundation.sql
// (themes table) so the owner-facing picker and live preview can render without a
// DB round-trip. hotels.theme_id references one of these ids.

export interface Theme {
  id: string
  name: string
  primary: string
  primaryDark: string
  accent: string
  surface: string
}

export const THEMES: Theme[] = [
  { id: 'classic-red',   name: 'Classic Red',   primary: '#C41E3A', primaryDark: '#9E1830', accent: '#F9E9EC', surface: '#ffffff' },
  { id: 'midnight-blue', name: 'Midnight Blue', primary: '#1E3A8A', primaryDark: '#162C6B', accent: '#E7ECFA', surface: '#ffffff' },
  { id: 'forest-green',  name: 'Forest Green',  primary: '#166534', primaryDark: '#0F4A25', accent: '#E6F2EB', surface: '#ffffff' },
  { id: 'sunset-amber',  name: 'Sunset Amber',  primary: '#B45309', primaryDark: '#8A3F07', accent: '#FBEEDD', surface: '#ffffff' },
  { id: 'slate-mono',    name: 'Slate Mono',    primary: '#334155', primaryDark: '#1E293B', accent: '#EEF1F5', surface: '#ffffff' },
]

export const DEFAULT_THEME_ID = 'classic-red'

export function getTheme(id: string | null | undefined): Theme {
  return THEMES.find(t => t.id === id) ?? THEMES[0]
}

// Inline CSS custom properties for a theme, applied to a preview container or
// the published page so `var(--theme-primary)` etc. resolve to the chosen colors.
// Typed as a plain string map so it can be spread into a React `style` prop
// without pulling React types into this framework-agnostic module.
export function themeVars(theme: Theme): Record<string, string> {
  return {
    '--theme-primary': theme.primary,
    '--theme-primary-dark': theme.primaryDark,
    '--theme-accent': theme.accent,
    '--theme-surface': theme.surface,
  }
}
