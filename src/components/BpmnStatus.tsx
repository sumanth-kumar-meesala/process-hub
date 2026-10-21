import { useEffect, useState } from 'react'
import { AlertTriangle, FileWarning, FolderOpen, Loader2, RefreshCw, Workflow } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { activeFolder, folderLabel, pageFolder, syncBpmn, useBpmn } from '@/store/bpmn'
import { parseFolderUrl } from '@/lib/sharepoint'
import { useData } from '@/store/store'

/** Loads the Signavio processes once the saved data is ready, and again when the tab comes back after a while. */
export function BpmnSync() {
  const hydrated = useData((s) => s.hydrated)
  useEffect(() => {
    if (!hydrated) return
    syncBpmn()
    const again = () => {
      const last = useBpmn.getState().lastSync
      if (document.visibilityState === 'visible' && (!last || Date.now() - Date.parse(last) > 5 * 60_000)) syncBpmn()
    }
    document.addEventListener('visibilitychange', again)
    return () => document.removeEventListener('visibilitychange', again)
  }, [hydrated])
  return null
}

const ago = (iso?: string) => {
  if (!iso) return ''
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000)
  return s < 60 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`
}

/** Choose the folder with the .bpmn files. Empty = the folder this page is in. Saved in this browser. */
export function BpmnFolderPicker({ onDone }: { onDone?: () => void }) {
  const { folderOverride, setFolderOverride } = useBpmn()
  const [value, setValue] = useState(folderOverride)
  const here = pageFolder()
  const parsed = value.trim() ? parseFolderUrl(value) : null
  const use = (folder: string) => { setFolderOverride(folder); onDone?.(); syncBpmn() }
  return (
    <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); if (parsed) use(value) }}>
      <label htmlFor="bpmn-folder" className="text-sm font-bold text-on-surface">Folder with the Signavio .bpmn files</label>
      <input id="bpmn-folder" value={value} onChange={(e) => setValue(e.target.value)} autoFocus={!!onDone}
        placeholder={here ? `This page's folder: ${folderLabel(here)}` : 'https://<company>.sharepoint.com/sites/<site>/Shared Documents/BPMN'}
        className="h-11 w-full rounded-[12px] border border-outline-variant bg-white px-3 text-sm box-border" />
      <p className="m-0 text-xs text-on-surface-variant">
        Paste the folder's address (open it in SharePoint and copy it from the browser bar), or type the name of a folder next to this page, e.g. <code>BPMN</code>.
        Sub-folders are read too and become areas. Saved in this browser.
        {parsed && <> Will read: <b>{decodeURIComponent(parsed.path)}</b></>}
        {value.trim() && !parsed && <span className="text-error"> That doesn't look like a folder address.</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={!parsed}>Use this folder</Button>
        {here && (folderOverride || value) && <Button type="button" size="sm" variant="outlined" onClick={() => { setValue(''); use('') }}>Use this page's folder</Button>}
        {onDone && <Button type="button" size="sm" variant="text" onClick={onDone}>Cancel</Button>}
      </div>
    </form>
  )
}

/** One line under the search: which folder the Signavio processes come from, and whether loading them worked. */
export function BpmnStatus({ canChange = true }: { canChange?: boolean }) {
  const { status, message, issues, lastSync, folderOverride } = useBpmn()
  const [open, setOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30_000); return () => clearInterval(t) }, [])
  if (status === 'off' && !picking) return null
  const folder = activeFolder()
  const link = 'inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-[13px] font-bold text-primary disabled:cursor-default disabled:opacity-50'
  return (
    <div role="status" className="flex flex-col gap-1.5 rounded-2xl bg-white px-4 py-2.5 text-[13px] text-on-surface-variant">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {folder && (
          <span className="inline-flex items-center gap-1.5" title={decodeURIComponent(parseFolderUrl(folder)?.path ?? folder)}>
            <FolderOpen size={14} aria-hidden /><b className="text-on-surface">{folderLabel(folder)}</b>{!folderOverride && ' (this page’s folder)'}
          </span>
        )}
        {status === 'loading' && <span className="inline-flex items-center gap-1.5"><Loader2 size={14} className="animate-spin" aria-hidden />Loading the Signavio processes…</span>}
        {status === 'ok' && <span className="inline-flex items-center gap-1.5"><Workflow size={14} className="text-primary" aria-hidden />{message} · updated {ago(lastSync)}</span>}
        {status === 'error' && <span className="inline-flex items-center gap-1.5 text-error"><AlertTriangle size={14} aria-hidden />Couldn't load the Signavio processes: {message}</span>}
        <button onClick={() => syncBpmn()} disabled={status === 'loading'} className={link}><RefreshCw size={13} aria-hidden />Refresh</button>
        {canChange && !picking && <button onClick={() => setPicking(true)} className={link}><FolderOpen size={13} aria-hidden />Change folder</button>}
        {issues.length > 0 && (
          <button onClick={() => setOpen(!open)} className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-[13px] font-bold text-[#9A4A00]">
            <FileWarning size={13} aria-hidden />{issues.length} file{issues.length === 1 ? '' : 's'} couldn't be read
          </button>
        )}
      </div>
      {open && issues.length > 0 && (
        <ul className="m-0 pl-5">
          {issues.map((x) => <li key={x.file}><b>{x.file}</b>: {x.reason}</li>)}
        </ul>
      )}
      {picking && <div className="border-t border-surface-mid pt-3"><BpmnFolderPicker onDone={() => setPicking(false)} /></div>}
    </div>
  )
}
