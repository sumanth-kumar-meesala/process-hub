import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { bpmnToProcess } from '@/lib/bpmn'
import { listBpmnFiles, onSharePoint, parseFolderUrl, readSpFile, SpError } from '@/lib/sharepoint'
import { useData } from './store'

/**
 * Keeps the processes in sync with the Signavio BPMN files in a SharePoint folder.
 *
 * Which folder: the one chosen in the app ("Change folder", saved in this browser)
 * → else the folder that process-hub.html itself is in (and its sub-folders).
 * Only files that changed since last time are downloaded again; processes whose file was removed are removed.
 */

export interface FileIssue { file: string; reason: string }

interface BpmnState {
  /** folder chosen in the app, kept in this browser only ('' = the page's own folder) */
  folderOverride: string
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
      status: 'off',
      message: '',
      issues: [],
      setFolderOverride: (folderOverride) => set({ folderOverride: folderOverride.trim() }),
    }),
    { name: 'process-hub-bpmn', partialize: (s) => ({ folderOverride: s.folderOverride }) },
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
