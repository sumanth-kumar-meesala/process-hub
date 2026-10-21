import { useEffect, useRef, type ReactNode } from 'react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'

/**
 * Router for SharePoint's HTML-page viewer, where history.pushState is not allowed.
 * Pages are kept in memory, and the current page is mirrored in location.hash (which is allowed),
 * so a reload or the browser's Back button still lands on the right page.
 */
export function SandboxRouter({ children }: { children: ReactNode }) {
  const start = location.hash.replace(/^#/, '') || '/'
  return (
    <MemoryRouter initialEntries={[start]}>
      <HashMirror />
      {children}
    </MemoryRouter>
  )
}

function HashMirror() {
  const loc = useLocation()
  const nav = useNavigate()
  const here = loc.pathname + loc.search
  const current = useRef(here)
  useEffect(() => {
    current.current = here
    if (location.hash.replace(/^#/, '') !== here) { try { location.hash = here } catch { /* not allowed: stay in memory */ } }
  }, [here])
  useEffect(() => {
    const onHash = () => { const h = location.hash.replace(/^#/, '') || '/'; if (h !== current.current) nav(h) }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [nav])
  return null
}
