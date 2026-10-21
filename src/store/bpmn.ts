import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { bpmnToProcess } from '@/lib/bpmn'
import { listBpmnFiles, onSharePoint, parseFolderUrl, readSpFile, SpError } from '@/lib/sharepoint'
import { useData } from './store'
import { inSandbox, localOrMemory } from '@/lib/sandbox'

// ---------- SharePoint HTML pages: files linked into the page ("live data") ----------

/** One file in the page's live-data list, as SharePoint expects it. */
export interface LiveItem { spItemUrl: string; label?: string; fileName?: string }
interface LiveResult { format?: string; content?: string; error?: string; errorCode?: string; metadata?: { fileName?: string } }
/** Written next to the live-data list by "Prepare the SharePoint page", to show where the files came from. */
export interface PageConfig { folder?: string; preparedAt?: string }

const readJson = <T,>(selector: string): T | undefined => {
  const el = document.querySelector(selector)
  if (!el?.textContent?.trim()) return undefined
  try { return JSON.parse(el.textContent) as T } catch { return undefined }
}
export const MANIFEST_SELECTOR = 'script.ka-livedata-manifest'
export const CONFIG_ID = 'process-hub-config'
const liveResults = () => (window as unknown as { __LD_RESULTS__?: Record<string, LiveResult> }).__LD_RESULTS__
/** What "Prepare the SharePoint page" wrote into this copy of the page, if anything. */
export const pageSetup = () => ({ items: readJson<LiveItem[]>(MANIFEST_SELECTOR) ?? [], config: readJson<PageConfig>(`#${CONFIG_ID}`) ?? {} })

const LIVE_ERRORS: Record<string, string> = {
  'access-denied': "you don't have access to this file", 'not-found': 'the file was not found (moved or deleted?)',
  protected: 'the file is protected (sensitivity label)', 'fetch-failed': 'SharePoint could not read the file',
  'decode-failed': "the file couldn't be read as text", 'parse-failed': "the file couldn't be read", 'invalid-request': 'the link to the file is not valid',
}

function loadLiveData() {
  const set = useBpmn.setState
  const items = readJson<LiveItem[]>(MANIFEST_SELECTOR) ?? []
  const cfg = readJson<PageConfig>(`#${CONFIG_ID}`) ?? {}
  const results = liveResults() ?? {}
  if (!items.length) {
    set({ status: 'error', issues: [], linked: { ...cfg, count: 0 }, message: 'No BPMN files are linked to this page yet. Open Process Hub on your computer → Admin → Processes → “Prepare the SharePoint page”.' })
    return
  }
  const idOf = (u: string) => u.match(/\/drives\/([^/]+)\/items\/([^/?#]+)/)?.slice(1).join('/') ?? u
  const issues: FileIssue[] = []
  const paths = new Set<string>()
  for (const it of items) {
    const name = it.label || it.fileName || 'BPMN file'
    // keyed by the exact spItemUrl; match on the ids too in case SharePoint rewrote the address
    const r = results[it.spItemUrl] ?? Object.entries(results).find(([k]) => idOf(k) === idOf(it.spItemUrl))?.[1]
    if (!r) { issues.push({ file: name, reason: 'SharePoint did not hand this file to the page' }); continue }
    if (r.error || typeof r.content !== 'string') { issues.push({ file: name, reason: (r.errorCode && LIVE_ERRORS[r.errorCode]) || r.error || 'no content' }); continue }
    const path = `sp:${idOf(it.spItemUrl)}`
    try {
      const out = bpmnToProcess(r.content, { file: name, path })
      const d = useData.getState()
      if (out.library.length) d.addLibraryItems(out.library)
      d.upsert(out.process)
      paths.add(path)
    } catch (e) { issues.push({ file: name, reason: reason(e) }) }
  }
  // files no longer linked to the page
  useData.getState().processes.filter((p) => p.source?.path?.startsWith('sp:') && !paths.has(p.source.path)).forEach((p) => useData.getState().remove(p.id))
  set({
    status: 'ok', issues, lastSync: new Date().toISOString(), linked: { ...cfg, count: items.length },
    message: `${paths.size} process${paths.size === 1 ? '' : 'es'} from Signavio`,
  })
}

/** In a SharePoint HTML page, asks SharePoint to read the linked files again (it reloads the page). */
export const refreshLiveData = () => { try { window.parent.postMessage({ type: 'ka-html-viewer-refresh' }, '*') } catch { /* not in SharePoint */ } }

/**
 * Keeps the processes in sync with the Signavio BPMN files in SharePoint. Two ways:
 *
 * 1. As a SharePoint HTML page (Site Pages): the page can't read folders itself. The files are linked into the page
 *    beforehand (Admin → "Prepare the SharePoint page" writes a "live data" list into process-hub.html), and SharePoint
 *    reads them with the viewer's own sign-in and hands them to the page in window.__LD_RESULTS__ before it starts.
 *
 * 2. On a SharePoint site that allows scripts in libraries (same origin): the app reads a folder through SharePoint's
 *    REST API — the folder chosen in the app ("Change folder", saved in this browser), else the page's own folder.
 *    Only files that changed since last time are downloaded again; processes whose file was removed are removed.
 */

export interface FileIssue { file: string; reason: string }

interface BpmnState {
  /** folder chosen in the app, kept in this browser only ('' = the page's own folder) */
  folderOverride: string
  /** 'page': files linked into this SharePoint page; 'folder': a folder read through SharePoint's REST API */
  mode: 'page' | 'folder'
  /** for 'page': the folder the files were picked from, and when the page was prepared */
  linked?: { folder?: string; preparedAt?: string; count: number }
  status: 'off' | 'loading' | 'ok' | 'error'
  message: string
  issues: FileIssue[]
  lastSync?: string
  setFolderOverride: (f: string) => void
}

export const useBpmn = create<BpmnState>()(
  persist(
    (set) => ({
      folderOverride: '',
      // inside SharePoint's page viewer (or wherever SharePoint handed over files) the linked files are used
      mode: inSandbox || !!liveResults() ? 'page' : 'folder',
      status: 'off',
      message: '',
      issues: [],
      setFolderOverride: (folderOverride) => set({ folderOverride: folderOverride.trim() }),
    }),
    { name: 'process-hub-bpmn', storage: createJSONStorage(localOrMemory), partialize: (s) => ({ folderOverride: s.folderOverride }) },
  ),
)

/** The folder this page was opened from, e.g. https://<company>.sharepoint.com/sites/Ops/Shared Documents/Process Hub */
export const pageFolder = () => onSharePoint() ? `${location.origin}${location.pathname.replace(/\/[^/]*$/, '')}` : ''

/** The folder in use: the one chosen in the app, or else the page's own folder. */
export const activeFolder = () => useBpmn.getState().folderOverride || pageFolder()

/** A short, readable form of a folder address, e.g. "Shared Documents / Process Hub". */
export const folderLabel = (raw: string) => {
  const f = parseFolderUrl(raw)
  if (!f) return raw
  const parts = f.path.split('/').filter(Boolean)
  return (['sites', 'teams'].includes(parts[0]?.toLowerCase()) ? parts.slice(2) : parts).join(' / ') || f.path
}

const reason = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** Runs `fn` over `items`, a few at a time. */
async function inBatches<T>(items: T[], size: number, fn: (x: T) => Promise<void>) {
  const queue = [...items]
  await Promise.all(Array.from({ length: Math.min(size, queue.length) }, async () => { while (queue.length) await fn(queue.shift()!) }))
}

/** files that couldn't be read, so they aren't downloaded again until they change */
const failed = new Map<string, { modified: string; issue: FileIssue | null }>()

let running: Promise<void> | null = null
/** Loads the BPMN folder (only one load runs at a time). */
export const syncBpmn = () => (running ??= doSync().finally(() => { running = null }))

async function doSync() {
  const set = useBpmn.setState
  if (useBpmn.getState().mode === 'page') { loadLiveData(); return }
  const raw = activeFolder()
  if (!raw) { set({ status: 'off', message: '', issues: [] }); return }
  const folder = parseFolderUrl(raw)
  if (!folder) { set({ status: 'error', message: "The BPMN folder address doesn't look right.", issues: [] }); return }
  set({ status: 'loading', message: '' })
  try {
    const { site, files } = await listBpmnFiles(folder)
    const fromSp = () => useData.getState().processes.filter((p) => p.source?.kind === 'bpmn' && p.source.path?.startsWith('/'))
    const known = new Map(fromSp().map((p) => [p.source!.path!, p]))
    const issues: FileIssue[] = []
    const changed = files.filter((f) => {
      const fail = failed.get(f.path)
      if (fail?.modified === f.modified) { if (fail.issue) issues.push(fail.issue); return false }
      return known.get(f.path)?.source?.modified !== f.modified
    })
    await inBatches(changed, 6, async (f) => {
      try {
        const xml = await readSpFile(site, f.path)
        const r = bpmnToProcess(xml, { file: f.name, path: f.path, modified: f.modified, folder: f.folder })
        const d = useData.getState()
        if (r.library.length) d.addLibraryItems(r.library)
        d.upsert(r.process)
      } catch (e) {
        // other (non-BPMN) .xml files in the folder are skipped quietly
        const notBpmn = /not a BPMN|not valid XML/i.test(reason(e))
        const issue = /\.xml$/i.test(f.name) && notBpmn ? null : { file: f.name, reason: reason(e) }
        if (issue) issues.push(issue)
        if (!(e instanceof SpError)) failed.set(f.path, { modified: f.modified, issue })
      }
    })
    // files that are no longer in the folder (or a different folder was chosen)
    const paths = new Set(files.map((f) => f.path))
    fromSp().filter((p) => !paths.has(p.source!.path!)).forEach((p) => useData.getState().remove(p.id))
    const count = fromSp().length
    set({
      status: 'ok', issues, lastSync: new Date().toISOString(),
      message: files.length ? `${count} process${count === 1 ? '' : 'es'} from Signavio` : 'The folder has no .bpmn files yet',
    })
  } catch (e) {
    set({ status: 'error', message: reason(e), issues: [] })
  }
}

/** Adds .bpmn files picked from the computer (works anywhere, also outside SharePoint). */
export async function importBpmnFiles(files: File[]) {
  let ok = 0
  const issues: FileIssue[] = []
  for (const f of files) {
    try {
      const r = bpmnToProcess(await f.text(), { file: f.name, path: `local:${f.name}`, modified: new Date(f.lastModified).toISOString() })
      const d = useData.getState()
      if (r.library.length) d.addLibraryItems(r.library)
      d.upsert(r.process)
      ok++
    } catch (e) { issues.push({ file: f.name, reason: reason(e) }) }
  }
  return { ok, issues }
}
