import { useSession } from '@/store/store'

/** The shared key, added at build time from the GitHub secret GROQ_API_KEY. Empty if none was set. */
export const SITE_KEY = (import.meta.env.VITE_GROQ_API_KEY ?? '').trim()

export type KeySource = 'browser' | 'site' | 'none'

/** A key saved in this browser (Admin → AI assistant) wins; otherwise the shared site key. */
export function resolveKey(browserKey: string): { key: string; source: KeySource } {
  if (browserKey.trim()) return { key: browserKey.trim(), source: 'browser' }
  if (SITE_KEY) return { key: SITE_KEY, source: 'site' }
  return { key: '', source: 'none' }
}

/** The key every AI feature uses. */
export const useAiKey = () => resolveKey(useSession((s) => s.groqKey))
