/**
 * Reads files from a SharePoint document library folder with SharePoint's own REST API.
 *
 * No app registration, admin consent or key is needed: when Process Hub is opened from the same SharePoint
 * (e.g. https://<company>.sharepoint.com/...), the browser sends the viewer's own sign-in with each request,
 * so everyone sees exactly the files they're allowed to open. From anywhere else (GitHub Pages, a local copy)
 * the browser blocks these requests.
 */

export interface SpFile {
  name: string
  /** server-relative path, e.g. /sites/Ops/Shared Documents/BPMN/Purchase.bpmn */
  path: string
  modified: string
  /** the sub-folder it sits in, relative to the chosen folder ('' for the folder itself) */
  folder: string
}

export interface SpFolder { origin: string; path: string }

/** Accepts the address of a folder as people copy it from SharePoint, in its usual shapes. */
export function parseFolderUrl(raw: string, base = location.href): SpFolder | null {
  raw = raw.trim()
  if (!raw) return null
  let u: URL
  try { u = new URL(raw, base) } catch { return null }
  const id = u.searchParams.get('id') || u.searchParams.get('RootFolder')
  let path = id ?? safeDecode(u.pathname)
  path = path
    .replace(/^\/:[a-z]:\/[rs]\//i, '/')     // /:f:/r/sites/… sharing-style links
    .replace(/\/Forms\/[^/]+\.aspx$/i, '')   // …/Forms/AllItems.aspx
    .replace(/\/+$/, '')
  if (!path.startsWith('/')) path = '/' + path
  return { origin: u.origin, path }
}

const safeDecode = (s: string) => { try { return decodeURIComponent(s) } catch { return s } }

export const onSharePoint = () => /\.sharepoint(-df)?\.(com|us|de|cn)$/i.test(location.hostname)

/** '…' as a REST parameter alias value. */
const alias = (p: string) => `'${encodeURIComponent(p.replace(/'/g, "''"))}'`

export class SpError extends Error {
  status?: number
  constructor(message: string, status?: number) { super(message); this.status = status }
}

async function api<T>(url: string, text = false): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, { credentials: 'include', headers: { Accept: text ? '*/*' : 'application/json;odata=nometadata' } })
  } catch {
    const target = new URL(url).origin
    if (target !== location.origin) throw new SpError(`That folder is on ${target}, but this page is on ${location.origin}. The app can only read folders on the SharePoint it was opened from.`)
    throw new SpError(onSharePoint()
      ? 'The browser could not reach SharePoint.'
      : `Process Hub is running from ${location.origin}, not from SharePoint, so the browser won't let it read SharePoint folders. Open the copy that's uploaded to SharePoint.`)
  }
  if (!res.ok) {
    let msg = ''
    try { const j = await res.json(); msg = j?.['odata.error']?.message?.value ?? j?.error?.message?.value ?? j?.error?.message ?? '' } catch { /* not JSON */ }
    if (res.status === 401 || res.status === 403) throw new SpError("You don't have access to this folder (or you're not signed in to SharePoint).", res.status)
    if (res.status === 404) throw new SpError('The folder was not found. Check its address.', 404)
    throw new SpError(`SharePoint said: ${res.status}${msg ? ` – ${msg}` : ''}`, res.status)
  }
  return (text ? res.text() : res.json()) as Promise<T>
}

/** Finds the site (or sub-site) that holds the folder, by trying the folder's parent paths. */
const siteCache = new Map<string, string>()
async function siteFor(f: SpFolder): Promise<string> {
  const key = f.origin + f.path
  const hit = siteCache.get(key)
  if (hit) return hit
  const parts = f.path.split('/').filter(Boolean)
  const from = ['sites', 'teams', 'personal'].includes(parts[0]?.toLowerCase()) ? 2 : 0
  const candidates: string[] = []
  for (let i = from; i < parts.length; i++) candidates.push(parts.slice(0, i).join('/'))
  if (!candidates.length) candidates.push('')
  let last: unknown
  for (const c of candidates) {
    const site = `${f.origin}${c ? '/' + c : ''}`
    try {
      await api(`${site}/_api/web/GetFolderByServerRelativePath(decodedurl=@a1)?@a1=${alias(f.path)}&$select=Name`)
      siteCache.set(key, site)
      return site
    } catch (e) {
      last = e
      if (e instanceof SpError && (e.status === 401 || e.status === 403 || !e.status)) throw e
    }
  }
  throw last instanceof Error ? last : new SpError('The folder was not found. Check its address.')
}

const isBpmn = (name: string) => /\.(bpmn|bpmn2)$/i.test(name) || /\.xml$/i.test(name)

/** Lists the BPMN files in a folder and its sub-folders (up to three levels down). */
export async function listBpmnFiles(folder: SpFolder): Promise<{ site: string; files: SpFile[] }> {
  const site = await siteFor(folder)
  const files: SpFile[] = []
  const walk = async (path: string, rel: string, depth: number) => {
    const a = `@a1=${alias(path)}`
    const [fs, ds] = await Promise.all([
      api<{ value: { Name: string; ServerRelativeUrl: string; TimeLastModified: string }[] }>(`${site}/_api/web/GetFolderByServerRelativePath(decodedurl=@a1)/Files?${a}&$select=Name,ServerRelativeUrl,TimeLastModified&$top=2000`),
      depth < 3 ? api<{ value: { Name: string; ServerRelativeUrl: string }[] }>(`${site}/_api/web/GetFolderByServerRelativePath(decodedurl=@a1)/Folders?${a}&$select=Name,ServerRelativeUrl&$top=500`) : Promise.resolve({ value: [] }),
    ])
    fs.value.filter((f) => isBpmn(f.Name)).forEach((f) => files.push({ name: f.Name, path: f.ServerRelativeUrl, modified: f.TimeLastModified, folder: rel }))
    await Promise.all(ds.value.filter((d) => d.Name !== 'Forms' && !d.Name.startsWith('_')).map((d) => walk(d.ServerRelativeUrl, rel ? `${rel} / ${d.Name}` : d.Name, depth + 1)))
  }
  await walk(folder.path, '', 0)
  return { site, files }
}

export const readSpFile = (site: string, path: string) =>
  api<string>(`${site}/_api/web/GetFileByServerRelativePath(decodedurl=@a1)/$value?@a1=${alias(path)}`, true)
