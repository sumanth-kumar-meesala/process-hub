import { Link, NavLink } from 'react-router-dom'
import { PERSONAS, type Persona } from '@/lib/types'
import { canBuild, personaUser, useSession } from '@/store/store'
import { cn } from '@/lib/utils'

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 text-on-surface no-underline">
      <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="5" cy="12" r="2.5" /><circle cx="19" cy="12" r="2.5" /><path d="M7.5 12h9" /><path d="m13 8.5 3.5 3.5-3.5 3.5" /></svg>
      </span>
      <span className="text-lg font-extrabold">Process Hub</span>
    </Link>
  )
}

const initials = (n: string) => n.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

export function AppHeader({ children }: { children?: React.ReactNode }) {
  const { persona, setPersona } = useSession()
  const nav = [
    { to: '/', label: 'Find a process', show: true },
    { to: '/ideas', label: 'Ideas', show: true },
    { to: '/builder', label: 'Builder', show: canBuild(persona) },
    { to: '/admin', label: 'Admin', show: persona === 'admin' },
  ].filter((n) => n.show)
  return (
    <header className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-8 print:hidden">
      <Logo />
      <nav aria-label="Main" className="ml-2 flex flex-wrap gap-1">
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'}
            className={({ isActive }) => cn('rounded-full px-4 py-2 text-sm font-bold no-underline', isActive ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-mid')}>
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="flex-1" />
      {children}
      <label className="flex h-10 items-center gap-2 rounded-full border border-outline-variant bg-white pl-4 pr-1 text-[13px] text-on-surface-variant">
        I am
        <select value={persona} onChange={(e) => setPersona(e.target.value as Persona)}
          className="h-8 rounded-full border-0 bg-surface-low px-2 text-[13px] font-bold text-on-surface">
          {PERSONAS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </label>
      <span title={personaUser(persona)} className={cn('flex h-10 w-10 items-center justify-center rounded-full text-sm font-extrabold', persona === 'admin' ? 'bg-on-surface text-white' : 'bg-secondary-container text-on-secondary-container')}>
        {initials(personaUser(persona))}
      </span>
    </header>
  )
}
