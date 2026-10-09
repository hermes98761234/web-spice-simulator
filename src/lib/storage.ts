export type Lang = 'en' | 'uk'
export type Theme = 'auto' | 'light' | 'dark'

export interface Settings {
  lang: Lang
  theme: Theme
  /** Log-frequency x axis for AC plots. */
  logX: boolean
  unwrap: boolean
}

export const DEFAULT_SETTINGS: Settings = { lang: 'en', theme: 'auto', logX: true, unwrap: true }

const SETTINGS_KEY = 'wss.settings'
const NETLIST_KEY = 'wss.netlist'

/** Validates untrusted JSON into Settings, falling back to defaults field by field. */
export function parseSettings(raw: string | null): Settings {
  if (!raw) return { ...DEFAULT_SETTINGS }
  try {
    const o = JSON.parse(raw) as Partial<Record<keyof Settings, unknown>>
    return {
      lang: o.lang === 'uk' || o.lang === 'en' ? o.lang : DEFAULT_SETTINGS.lang,
      theme: o.theme === 'light' || o.theme === 'dark' || o.theme === 'auto' ? o.theme : DEFAULT_SETTINGS.theme,
      logX: typeof o.logX === 'boolean' ? o.logX : DEFAULT_SETTINGS.logX,
      unwrap: typeof o.unwrap === 'boolean' ? o.unwrap : DEFAULT_SETTINGS.unwrap,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function get(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function set(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* storage full or blocked */ }
}

export function loadSettings(): Settings {
  const s = parseSettings(get(SETTINGS_KEY))
  if (get(SETTINGS_KEY) === null && typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('uk')) s.lang = 'uk'
  return s
}
export const saveSettings = (s: Settings) => set(SETTINGS_KEY, JSON.stringify(s))
export const loadNetlist = (): string | null => get(NETLIST_KEY)
export const saveNetlist = (t: string) => set(NETLIST_KEY, t)

/** File name for a download, derived from the netlist title: "RC low-pass (v2)" -> "rc-low-pass-v2.cir". */
export function fileNameFor(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')
  return (slug || 'circuit') + '.cir'
}
