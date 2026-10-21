import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Download, ExternalLink, FileUp, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { bpmnToProcess } from '@/lib/bpmn'
import { parseFolderUrl } from '@/lib/sharepoint'
import { FILES_ID, packFile, pageFiles, unpackFile } from '@/lib/pagefiles'
import { pageSource } from '@/lib/snapshot'
import { CONFIG_ID, MANIFEST_SELECTOR, pageSetup, type LiveItem, type PageConfig } from '@/store/bpmn'

/**
 * "Prepare the page": saves a copy of process-hub.html with the chosen .bpmn files inside it.
 * The page turns them into processes itself each time it opens — on your computer or on SharePoint.
 *
 * Optionally the files can be linked to their copies in a SharePoint folder (by drive and item id, at most 32):
 * on SharePoint the page then uses the latest version from there, so a file that's changed in Signavio and exported
 * again under the same name shows up without preparing the page again. Finding those ids needs no admin rights:
 * the person opens one SharePoint address in their own browser (signed in), copies what it shows and pastes it here.
 */

const MAX_LIVE = 32

// This code ends up inside an inline <script> in process-hub.html, where the text "</script" (or "</head")
// would end that script early — so those tags are put together at run time instead of written out.
const LT = String.fromCharCode(60)
const SCRIPT = 'script', HEAD = 'head'

/** "u!" + unpadded base64url of the address: how SharePoint's /shares API takes a link. */
const shareToken = (url: string) => {
  let bin = ''
  new TextEncoder().encode(url).forEach((b) => { bin += String.fromCharCode(b) })
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
  let viaPath: string | undefined
  const m = !sharing && f.path.match(/^(\/(?:sites|teams)\/[^/]+)?\/Shared Documents(\/.*)?$/i)
  if (m) viaPath = `${f.origin}${encodeURI(m[1] ?? '')}/_api/v2.0/drive/${m[2] ? `root:${encodeURI(m[2])}:` : 'root'}/children?${select}`
  return { origin: f.origin, folder: sharing ? raw : `${f.origin}${f.path}`, viaShare, viaPath }
}

/** The folder's files (name → SharePoint address), from what the SharePoint tab showed. */
function readListing(text: string, origin: string): { byName: Map<string, string>; error?: string } {
  const byName = new Map<string, string>()
  let data: unknown
  try { data = JSON.parse(text) } catch { return { byName, error: "That isn't the list of files. Copy everything the SharePoint tab shows (⌘A / Ctrl+A, then copy) and paste it here." } }
  const d = data as { value?: unknown[]; error?: { message?: string | { value?: string } } }
  if (d.error) {
    const msg = typeof d.error.message === 'string' ? d.error.message : d.error.message?.value
    return { byName, error: `SharePoint said: ${(msg ?? 'error').replace(/\.$/, '')}. Try the other link, or check the folder address.` }
  }
  const list = Array.isArray(data) ? data : d.value
  if (!Array.isArray(list)) return { byName, error: "That doesn't look like a list of files." }
  for (const x of list as { id?: string; name?: string; folder?: unknown; parentReference?: { driveId?: string } }[]) {
    if (x?.name && x.id && x.parentReference?.driveId && !x.folder) byName.set(x.name.toLowerCase(), `${origin}/_api/v2.0/drives/${x.parentReference.driveId}/items/${x.id}`)
  }
  return { byName }
}

/** Puts the files (and the live-data list, and where they came from) into the page, replacing any earlier ones. */
function buildPage(html: string, blocks: { attr: string; json: unknown }[]) {
  const json = (o: unknown) => JSON.stringify(o).replace(/</g, '\\u003c')
  const old = (attr: string) => new RegExp(`${LT}${SCRIPT}[^>]*${attr}[^>]*>[\\s\\S]*?${LT}\\/${SCRIPT}>\\s*`, 'g')
  let out = html
  for (const a of [`class="${MANIFEST_SELECTOR.split('.')[1]}"`, `id="${CONFIG_ID}"`, `id="${FILES_ID}"`]) out = out.replace(old(a), '')
  const add = blocks.map((b) => `${LT}${SCRIPT} type="application/json" ${b.attr}>${json(b.json)}${LT}/${SCRIPT}>\n`).join('')
  return out.replace(new RegExp(`${LT}\\/${HEAD}>`, 'i'), `${add}${LT}/${HEAD}>`)
}

interface Chosen { name: string; text: string; summary?: string; error?: string }
const describe = (name: string, text: string): Chosen => {
  try {
    const { process: p } = bpmnToProcess(text, { file: name })
    const steps = p.steps.filter((s) => s.kind === 'step' || s.kind === 'decision').length
    return { name, text, summary: `${p.code ? `${p.code} · ` : ''}${p.title} — ${steps} steps, ${p.stages.length} stages, ${p.roles.length} roles` }
  } catch (e) { return { name, text, error: e instanceof Error ? e.message : String(e) } }
}

export function PreparePage() {
  const prior = useMemo(() => pageSetup(), [])
  const [files, setFiles] = useState<Chosen[]>([])
  const [folder, setFolder] = useState(prior.config.folder ?? '')
  const [pasted, setPasted] = useState('')
  const [ready, setReady] = useState<{ url: string; count: number; live: number } | null>(null)
  const [saved, setSaved] = useState(false)
  const pick = useRef<HTMLInputElement>(null)

  // start from the files already in this page, if any
  useEffect(() => {
    let off = false
    Promise.all(pageFiles().map(async (f) => describe(f.name, await unpackFile(f)))).then((list) => { if (!off && list.length) setFiles(list) })
    return () => { off = true }
  }, [])

  const add = async (list: FileList | null) => {
    if (!list?.length) return
    const read = await Promise.all([...list].map(async (f) => describe(f.name, await f.text())))
    setFiles((cur) => [...cur.filter((c) => !read.some((r) => r.name.toLowerCase() === c.name.toLowerCase())), ...read].sort((a, b) => a.name.localeCompare(b.name)))
    if (pick.current) pick.current.value = ''
  }
  const good = files.filter((f) => !f.error)

  const links = linksFor(folder)
  const listing = links && pasted.trim() ? readListing(pasted, links.origin) : null
  const liveFor = (name: string) => (listing && !listing.error ? listing.byName.get(name.toLowerCase()) : undefined)
  const linked = good.filter((f) => liveFor(f.name)).length

  // the page is made as soon as the choices change, so "Save" is a plain link the person clicks
  // (browsers like Safari block downloads that start on their own)
  useEffect(() => {
    if (!good.length) { setReady(null); return }
    let off = false, url = ''
    ;(async () => {
      let liveLeft = MAX_LIVE
      const packed = await Promise.all(good.map((f) => {
        const sp = liveFor(f.name)
        return packFile(f.name, f.text, sp && liveLeft-- > 0 ? sp : undefined)
      }))
      const manifest: LiveItem[] = packed.filter((f) => f.spItemUrl).map((f) => ({ spItemUrl: f.spItemUrl!, label: f.name }))
      const cfg: PageConfig = { folder: links && manifest.length ? links.folder : undefined, preparedAt: new Date().toISOString() }
      const blocks = [{ attr: `id="${FILES_ID}"`, json: packed as unknown }, { attr: `id="${CONFIG_ID}"`, json: cfg as unknown }]
      if (manifest.length) blocks.push({ attr: `class="${MANIFEST_SELECTOR.split('.')[1]}"`, json: manifest })
      const html = buildPage(pageSource, blocks)
      if (off) return
      url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
      setReady({ url, count: packed.length, live: manifest.length })
      setSaved(false)
    })()
    return () => { off = true; if (url) URL.revokeObjectURL(url) }
  }, [files, pasted, folder]) // eslint-disable-line react-hooks/exhaustive-deps

  const n = (k: number) => <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-primary text-xs font-bold text-white">{k}</span>
  const stepCls = 'flex gap-3'
  return (
    <div className="flex flex-col gap-5">
      <div className={stepCls}>{n(1)}
        <div className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
          <b>Choose the .bpmn files (Signavio → Export → BPMN 2.0 XML)</b>
          <input ref={pick} type="file" multiple accept=".bpmn,.bpmn2,.xml" className="hidden" onChange={(e) => add(e.target.files)} />
          <div><Button size="sm" variant="tonal" onClick={() => pick.current?.click()}><FileUp size={15} />{files.length ? 'Add more files…' : 'Choose .bpmn files…'}</Button></div>
          {files.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {files.map((f) => (
                <li key={f.name} className="flex items-start gap-2 rounded-[10px] bg-white px-3 py-2 text-[13px]">
                  <span className="min-w-0 flex-1"><b className="break-words">{f.name}</b><br />
                    {f.error ? <span className="text-error">Can't be read: {f.error}</span> : <span className="text-on-surface-variant">{f.summary}{liveFor(f.name) ? ' · linked to SharePoint' : ''}</span>}
                  </span>
                  <button aria-label={`Remove ${f.name}`} onClick={() => setFiles((cur) => cur.filter((c) => c !== f))} className="cursor-pointer border-0 bg-transparent p-0.5 text-on-surface-variant"><X size={15} /></button>
                </li>
              ))}
            </ul>
          )}
          <span className="text-xs text-on-surface-variant">The files are saved inside the page, and the page turns them into processes each time it opens.</span>
        </div>
      </div>

      <details open={!!prior.config.folder}>
        <summary className="flex cursor-pointer list-none gap-3">{n(2)}<b className="text-sm">Optional: keep them up to date from SharePoint</b></summary>
        <div className="mt-2 flex flex-col gap-2 pl-9 text-sm">
          <span className="text-[13px] text-on-surface-variant">Link the files to the SharePoint folder they're in. On SharePoint the page then shows the latest version of each file, so a file changed in Signavio and exported again under the same name updates by itself. (New files still need “Prepare the page” again.)</span>
          <input value={folder} onChange={(e) => { setFolder(e.target.value); setPasted('') }}
            placeholder="SharePoint folder address, e.g. https://<company>.sharepoint.com/sites/<site>/Shared Documents/BPMN"
            className="h-11 w-full rounded-[12px] border border-outline-variant bg-white px-3 text-sm box-border" />
          {folder.trim() && !links && <span className="text-xs text-error">That isn't a SharePoint folder address (it should start with https://…sharepoint.com/).</span>}
          {links && (
            <>
              <a href={links.viaShare} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-bold text-primary"><ExternalLink size={14} aria-hidden />Open the list of files in this folder</a>
              {links.viaPath && <a href={links.viaPath} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] text-primary"><ExternalLink size={13} aria-hidden />If that shows an error, try this link instead</a>}
              <span className="text-xs text-on-surface-variant">It opens in a new tab with your own SharePoint sign-in. Select everything there (⌘A / Ctrl+A), copy, and paste it here:</span>
              <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={3} placeholder='{"@odata.context": … "value": [ … ] }'
                className="w-full rounded-[12px] border border-outline-variant bg-white p-3 font-mono text-xs box-border" />
              {listing?.error && <span className="text-[13px] text-error">{listing.error}</span>}
              {listing && !listing.error && good.length > 0 && (
                <span className="text-[13px] text-on-surface-variant">
                  {linked} of {good.length} file{good.length === 1 ? '' : 's'} found in the folder and linked.
                  {linked < good.length && <> Not in the folder: {good.filter((f) => !liveFor(f.name)).map((f) => f.name).join(', ')} (the copy saved in the page is used).</>}
                  {linked > MAX_LIVE && <> Only {MAX_LIVE} files can be linked per page; the rest use the saved copy.</>}
                </span>
              )}
            </>
          )}
        </div>
      </details>

      <div className={stepCls}>{n(3)}
        <div className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
          <b>Save the page</b>
          {!ready && <span className="text-[13px] text-on-surface-variant">{good.length ? 'Preparing…' : 'Choose at least one .bpmn file first.'}</span>}
          {ready && (
            <div className="flex flex-col gap-2 rounded-[12px] bg-secondary-container/60 p-3 text-[13px] text-on-secondary-container">
              <span className="flex items-start gap-2"><CheckCircle2 size={16} className="mt-0.5 flex-none" aria-hidden />
                Ready: process-hub.html with {ready.count} BPMN file{ready.count === 1 ? '' : 's'} inside{ready.live ? ` (${ready.live} linked to SharePoint for updates)` : ''}.</span>
              <div><a href={ready.url} download="process-hub.html" onClick={() => setSaved(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-[13px] font-bold text-white no-underline"><Download size={15} aria-hidden />Save process-hub.html</a></div>
              {saved && (
                <ol className="m-0 flex flex-col gap-1 pl-5">
                  <li>It's in your <b>Downloads</b> (if there was one already, it may be called <b>process-hub (1).html</b> — use the newest).</li>
                  <li>Double-click it to check: the processes are in the list, with a <b>Signavio</b> tag.</li>
                  <li>Upload it to SharePoint in place of the old process-hub.html and open it there.</li>
                </ol>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
