import { Link } from 'react-router-dom'
import { useData } from '@/store/store'
import type { LibraryItem } from '@/lib/types'

/** Opens a library item: its link, the Process Hub process it stands for, or nothing yet. */
export function ResourceLink({ it, className, children }: { it: LibraryItem; className: string; children: React.ReactNode }) {
  const processes = useData((st) => st.processes)
  if (it.category === 'process') {
    const target = processes.find((p) => p.id === it.processId || p.title.toLowerCase() === it.title.toLowerCase())
    if (target) return <Link to={`/process/${target.id}`} className={className}>{children}</Link>
  }
  if (it.url) return <a href={it.url} target="_blank" rel="noreferrer" className={className}>{children}</a>
  return <a href="#" onClick={(e) => e.preventDefault()} title="No link added yet" className={className}>{children}</a>
}
