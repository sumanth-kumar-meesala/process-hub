import { useMemo, useRef, useState } from 'react'
import { CheckCircle2, Download, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { parseFolderUrl } from '@/lib/sharepoint'
import { CONFIG_ID, MANIFEST_SELECTOR, pageSetup, type LiveItem, type PageConfig } from '@/store/bpmn'

/**
 * "Prepare the SharePoint page": links the BPMN files of one SharePoint folder into a copy of process-hub.html.
 *
 * A SharePoint HTML page can't read a folder itself — it may only list up to 32 files (by drive and item id) in a
 * "live data" block; SharePoint then reads them with the viewer's own sign-in. This finds those ids without any
 * admin rights: the person opens one SharePoint address in their own browser (signed in), copies what it shows,
 * and pastes it here.
 */

const MAX = 32
const isBpmn = (n: string) => /\.(bpmn|bpmn2|xml)$/i.test(n)

/** "u!" + unpadded base64url of the address: how SharePoint's /shares API takes a link. */
const shareToken = (url: string) => {
  const bytes = new TextEncoder().encode(url)
  let bin = ''
  bytes.forEach((b) => { bin += String.fromCharCode(b) })
  return 'u!' + btoa(bin).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

interface Links { origin: string; folder: string; viaShare: string; viaPath?: string }
function linksFor(raw: string): Links | null {
  raw = raw.trim()
  if (!/^https:\/\/[^/]+\.sharepoint(-df)?\.(com|us|de|cn)\//i.test(raw)) return null
  const u = new URL(raw)
  const sharing = /^\/:[a-z]:\/[st]\//i.test(u.pathname)               // "Copy link" style: /:f:/s/Site/Eb…
  const f = parseFolderUrl(raw)
  if (!f) return null
  const folder = sharing ? raw : `${f.origin}${encodeURI(f.path)}`
  const select = '$select=id,name,parentReference,file,folder&$top=500'
  const viaShare = `${f.origin}/_api/v2.0/shares/${shareToken(folder)}/driveItem/children?${select}`
  // second way, for the site's default "Documents" library: by path
  let viaPath: string | undefined
  const m = !sharing && f.path.match(/^(\/(?:sites|teams)\/[^/]+)?\/Shared Documents(\/.*)?$/i)
  if (m) viaPath = `${f.origin}${encodeURI(m[1] ?? '')}/_api/v2.0/drive/${m[2] ? `root:${encodeURI(m[2])}:` : 'root'}/children?${select}`
  return { origin: f.origin, folder: sharing ? raw : `${f.origin}${f.path}`, viaShare, viaPath }
}

interface Found { items: LiveItem[]; skipped: string[]; folders: string[]; error?: string }
function readListing(text: string, origin: string): Found {
  const out: Found = { items: [], skipped: [], folders: [] }
  let data: unknown
  try { data = JSON.parse(text) } catch { return { ...out, error: "That isn't the list of files. Copy everything the SharePoint tab shows (Ctrl+A / ⌘A, then copy) and paste it here." } }
  const d = data as { value?: unknown[]; error?: { message?: string | { value?: string } } }
  if (d.error) {
    const msg = typeof d.error.message === 'string' ? d.error.message : d.error.message?.value
    return { ...out, error: `SharePoint said: ${(msg ?? 'error').replace(/\.$/, '')}. Try the other link, or check the folder address.` }
  }
  const list = Array.isArray(data) ? data : d.value
  if (!Array.isArray(list)) return { ...out, error: "That doesn't look like a list of files." }
  for (const x of list as { id?: string; name?: string; folder?: unknown; parentReference?: { driveId?: string } }[]) {
    if (!x?.name) continue
    if (x.folder) { out.folders.push(x.name); continue }
    if (!isBpmn(x.name)) continue
    const drive = x.parentReference?.driveId
    if (!x.id || !drive) { out.skipped.push(x.name); continue }
    // no fileName on purpose: without it SharePoint hands the file over as plain text, which is what a .bpmn file is
    out.items.push({ spItemUrl: `${origin}/_api/v2.0/drives/${drive}/items/${x.id}`, label: x.name })
  }
  out.items.sort((a, b) => (a.label ?? '').localeCompare(b.label ?? ''))
  return out
}

// This code itself ends up inside an inline <script> in process-hub.html, where the text "</script" (or "</head")
// would end that script early — so those tags are put together at run time instead of written out.
const LT = String.fromCharCode(60)
const SCRIPT = 'script', HEAD = 'head'

/** Puts the live-data list (and where it came from) into the page, replacing any earlier one. */
function withLiveData(html: string, items: LiveItem[], cfg: PageConfig) {
  const json = (o: unknown) => JSON.stringify(o).replace(/</g, '\\u003c')
  const cls = MANIFEST_SELECTOR.split('.')[1]
  const open = (attr: string) => `${LT}${SCRIPT} type="application/json" ${attr}>`
  const close = `${LT}/${SCRIPT}>`
  const old = (attr: string) => new RegExp(`${LT}${SCRIPT}[^>]*${attr}[^>]*>[\\s\\S]*?${LT}\\/${SCRIPT}>\\s*`, 'g')
  const cleaned = html.replace(old(`class="${cls}"`), '').replace(old(`id="${CONFIG_ID}"`), '')
  const block = `${open(`class="${cls}"`)}${json(items)}${close}\n${open(`id="${CONFIG_ID}"`)}${json(cfg)}${close}\n`
  const endHead = new RegExp(`${LT}\\/${HEAD}>`, 'i')
  return cleaned.replace(endHead, `${block}${LT}/${HEAD}>`)
}

export function PreparePage() {
  const prior = useMemo(() => pageSetup(), [])
  const [folder, setFolder] = useState(prior.config.folder ?? '')
  const [pasted, setPasted] = useState('')
  const [done, setDone] = useState('')
  const [pickError, setPickError] = useState('')
  const pick = useRef<HTMLInputElement>(null)
  const links = linksFor(folder)
  const found = links && pasted.trim() ? readListing(pasted, links.origin) : null
  const usable = found && !found.error ? found.items.slice(0, MAX) : []

  const make = async (file?: File) => {
    setPickError(''); setDone('')
    if (!file || !links) return
    const html = await file.text()
    if (!html.includes(`${LT}div id="root">`) || !html.includes('Process Hub')) { setPickError("That isn't process-hub.html. Choose the process-hub.html file you upload to SharePoint."); return }
    const out = withLiveData(html, usable, { folder: links.folder, preparedAt: new Date().toISOString() })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([out], { type: 'text/html' }))
    a.download = 'process-hub.html'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    setDone(`Saved a new process-hub.html with ${usable.length} BPMN file${usable.length === 1 ? '' : 's'} linked (look in your Downloads).`)
    if (pick.current) pick.current.value = ''
  }

  const n = (k: number) => <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-primary text-xs font-bold text-white">{k}</span>
  const stepCls = 'flex gap-3'
  return (
    <div className="flex flex-col gap-4">
      {prior.items.length > 0 && (
        <p className="m-0 text-[13px] text-on-surface-variant">This copy of the page already has {prior.items.length} file{prior.items.length === 1 ? '' : 's'} linked{prior.config.folder ? <> from <b>{decodeURIComponent(prior.config.folder)}</b></> : ''}. Doing this again replaces them.</p>
      )}

      <div className={stepCls}>{n(1)}
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-bold">The SharePoint folder with the .bpmn files
          <input value={folder} onChange={(e) => { setFolder(e.target.value); setPasted(''); setDone('') }}
            placeholder="https://<company>.sharepoint.com/sites/<site>/Shared Documents/BPMN"
            className="h-11 w-full rounded-[12px] border border-outline-variant bg-white px-3 text-sm font-normal box-border" />
          <span className="text-xs font-normal text-on-surface-variant">Open the folder in SharePoint and copy the address from the browser bar (or use “Copy link” on the folder).</span>
          {folder.trim() && !links && <span className="text-xs font-normal text-error">That isn't a SharePoint folder address (it should start with https://…sharepoint.com/).</span>}
        </label>
      </div>

      {links && (
        <div className={stepCls}>{n(2)}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm">
            <b>Open this link — it shows the folder's files as text</b>
            <a href={links.viaShare} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 break-all font-bold text-primary"><ExternalLink size={14} className="flex-none" aria-hidden />List the files in this folder</a>
            {links.viaPath && <a href={links.viaPath} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] text-primary"><ExternalLink size={13} className="flex-none" aria-hidden />If that shows an error, try this link instead</a>}
            <span className="text-xs text-on-surface-variant">It opens in a new tab, with your own SharePoint sign-in. Select everything on that tab (Ctrl+A / ⌘A), copy it, and paste it below.</span>
            <textarea value={pasted} onChange={(e) => { setPasted(e.target.value); setDone('') }} rows={4} placeholder='{"@odata.context": … "value": [ … ] }'
              className="w-full rounded-[12px] border border-outline-variant bg-white p-3 font-mono text-xs box-border" />
            {found?.error && <span className="text-[13px] text-error">{found.error}</span>}
            {found && !found.error && (
              <div className="text-[13px] text-on-surface-variant">
                {found.items.length ? <>Found <b>{found.items.length}</b> BPMN file{found.items.length === 1 ? '' : 's'}: {found.items.map((x) => x.label).join(', ')}.</> : <span className="text-error">No .bpmn files in this folder.</span>}
                {found.items.length > MAX && <span className="text-error"> A SharePoint page can link at most {MAX} files, so only the first {MAX} are used — split the rest into another folder and page.</span>}
                {found.folders.length > 0 && <> Sub-folders ({found.folders.join(', ')}) aren't included — put all the files in this one folder.</>}
              </div>
            )}
          </div>
        </div>
      )}

      {usable.length > 0 && (
        <div className={stepCls}>{n(3)}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm">
            <b>Choose your process-hub.html — a copy with these files linked is saved to your Downloads</b>
            <input ref={pick} type="file" accept=".html,text/html" className="hidden" onChange={(e) => make(e.target.files?.[0])} />
            <div><Button size="sm" onClick={() => pick.current?.click()}><Download size={15} />Choose process-hub.html…</Button></div>
            {pickError && <span className="text-[13px] text-error">{pickError}</span>}
            {done && (
              <div className="flex items-start gap-2 rounded-[12px] bg-secondary-container/60 p-3 text-[13px] text-on-secondary-container">
                <CheckCircle2 size={16} className="mt-0.5 flex-none" aria-hidden />
                <span>{done} Upload it to the site's <b>Site Pages</b> library in place of the old one. From then on, BPMN files that are changed and exported again under the same name update by themselves; to add or remove files, do this again.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
