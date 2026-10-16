import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import { get, set, del } from 'idb-keyval'
import { SEED } from '@/data/seed'
import type { Persona, Process } from '@/lib/types'

/** IndexedDB-backed storage: the app's own small database, kept in the browser. */
const idbStorage: StateStorage = {
  getItem: async (name) => (await get(name)) ?? null,
  setItem: async (name, value) => { await set(name, value) },
  removeItem: async (name) => { await del(name) },
}

export interface Person { id: string; name: string; note: string; persona: Persona }

interface DataState {
  processes: Process[]
  people: Person[]
  hydrated: boolean
  upsert: (p: Process) => void
  remove: (id: string) => void
  importMany: (ps: Process[]) => number
  resetToStarter: () => void
  setPersonPersona: (id: string, persona: Persona) => void
  addPerson: (name: string) => void
}

const START_PEOPLE: Person[] = [
  { id: 'erin', name: 'Erin Hannah', note: 'Owns FS25 Client Specific Training', persona: 'owner' },
  { id: 'evan', name: 'Evan Westgarth', note: 'Executive owner · FS25', persona: 'executive' },
  { id: 'alex', name: 'Alex Chen', note: 'House Supervisor', persona: 'performer' },
  { id: 'admin', name: 'Global Admin', note: 'Process team', persona: 'admin' },
]

export const useData = create<DataState>()(
  persist(
    (setS, getS) => ({
      processes: SEED,
      people: START_PEOPLE,
      hydrated: false,
      upsert: (p) => setS((s) => {
        const next = { ...p, updatedAt: new Date().toISOString() }
        const i = s.processes.findIndex((x) => x.id === p.id)
        const list = [...s.processes]
        if (i >= 0) list[i] = next; else list.push(next)
        return { processes: list }
      }),
      remove: (id) => setS((s) => ({ processes: s.processes.filter((p) => p.id !== id) })),
      importMany: (ps) => {
        let n = 0
        ps.forEach((p) => { if (p && p.id && p.title && Array.isArray(p.stages)) { getS().upsert(p); n++ } })
        return n
      },
      resetToStarter: () => setS({ processes: SEED }),
      setPersonPersona: (id, persona) => setS((s) => ({ people: s.people.map((x) => x.id === id ? { ...x, persona } : x) })),
      addPerson: (name) => setS((s) => ({ people: [...s.people, { id: 'p' + Date.now(), name, note: '', persona: 'performer' }] })),
    }),
    {
      name: 'process-hub-data',
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({ processes: s.processes, people: s.people }),
      onRehydrateStorage: () => () => { useData.setState({ hydrated: true }) },
    },
  ),
)

interface SessionState {
  persona: Persona
  /** the role the viewer "works as", used to highlight their steps */
  myRole: string
  groqKey: string
  model: string
  setPersona: (p: Persona) => void
  setMyRole: (r: string) => void
  setGroq: (key: string, model: string) => void
}

/** Per-viewer settings. The Groq key lives only in this browser's localStorage. */
export const useSession = create<SessionState>()(
  persist(
    (setS) => ({
      persona: 'performer',
      myRole: 'House Supervisor',
      groqKey: '',
      model: 'openai/gpt-oss-120b',
      setPersona: (persona) => setS({ persona }),
      setMyRole: (myRole) => setS({ myRole }),
      setGroq: (groqKey, model) => setS({ groqKey, model }),
    }),
    { name: 'process-hub-session' },
  ),
)

/** Who the persona stands for in this prototype (no real sign-in yet). */
export const personaUser = (p: Persona) =>
  p === 'owner' ? 'Erin Hannah' : p === 'admin' ? 'Global Admin' : p === 'executive' ? 'Evan Westgarth' : 'Alex Chen'

export const canBuild = (p: Persona) => p === 'owner' || p === 'admin'
export const canEdit = (p: Persona, proc: Process) => p === 'admin' || (p === 'owner' && (proc.owner === 'Erin Hannah' || !proc.seeded))
