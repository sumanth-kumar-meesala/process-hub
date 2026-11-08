/**
 * True when the app runs inside SharePoint's HTML-page viewer (Site Pages → an uploaded .html page).
 * SharePoint shows such a page in a sandboxed iframe (srcdoc, opaque "null" origin) where:
 *  - there is no browser storage (localStorage, IndexedDB…) — everything stays in memory,
 *  - history.pushState / replaceState throw — only location.hash may be set,
 *  - the page can't make network requests — files come from SharePoint's "live data" instead
 *    (window.__LD_RESULTS__, see src/store/bpmn.ts).
 */
export const inSandbox: boolean = (() => {
  // (an about:srcdoc frame with a real origin is the SPFx web part: not sandboxed, parent is SharePoint)
  // (a file opened from disk also has a "null" origin, but it isn't sandboxed: that's where the page is prepared)
  try { return window.origin === 'null' && location.protocol !== 'file:' } catch { return true }
})()

/** localStorage where the browser allows it, otherwise a stand-in that keeps things in memory (SharePoint pages). */
export function localOrMemory(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  try { const ls = window.localStorage; ls.getItem('x'); return ls } catch { /* blocked */ }
  return memoryStorage
}
const mem = new Map<string, string>()
const memoryStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => { mem.set(k, v) },
  removeItem: (k: string) => { mem.delete(k) },
}

/** The window whose address is the real page: the parent when running in the SPFx web part's srcdoc frame. */
export const hostWindow = (): Window => { try { if (location.protocol === 'about:' && window.parent !== window) { void window.parent.location.href; return window.parent } } catch { /* cross-origin */ } return window }
