import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import { get, set, del } from 'idb-keyval'
import { SEED } from '@/data/seed'
import { SEED_LIBRARY } from '@/data/library'
import { SEED_GLOSSARY, type Term } from '@/data/glossary'
import { autoAssign } from '@/lib/resources'
import type { LibraryItem, Persona, Process } from '@/lib/types'

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
  library: LibraryItem[]
  glossary: Term[]
  setGlossary: (g: Term[]) => void
  addLibraryItems: (items: LibraryItem[]) => void
  updateLibraryItem: (id: string, patch: Partial<LibraryItem>) => void
  removeLibraryItem: (id: string) => void
  hydrated: boolean
  upsert: (p: Process) => void
  remove: (id: string) => void
  importMany: (ps: Process[]) => number
  resetToStarter: () => void
  setPersonPersona: (id: string, persona: Persona) => void
  addPerson: (name: string) => void
}

const START_PEOPLE: Person[] = [
  { id: 'priya', name: 'Priya Sharma', note: 'Owns FS25 Client Specific Training', persona: 'owner' },
  { id: 'daniel', name: 'Daniel Brooks', note: 'Executive owner · FS25', persona: 'executive' },
  { id: 'alex', name: 'Alex Chen', note: 'House Supervisor', persona: 'performer' },
  { id: 'admin', name: 'Global Admin', note: 'Process team', persona: 'admin' },
]

export const useData = create<DataState>()(
  persist(
    (setS, getS) => ({
      processes: SEED,
      people: START_PEOPLE,
      library: SEED_LIBRARY,
      glossary: SEED_GLOSSARY,
      hydrated: false,
      setGlossary: (glossary) => setS({ glossary }),
      addLibraryItems: (items) => setS((s) => ({ library: [...s.library, ...items.filter((it) => !s.library.some((x) => x.id === it.id || x.title.toLowerCase() === it.title.toLowerCase()))] })),
      updateLibraryItem: (id, patch) => setS((s) => ({ library: s.library.map((x) => x.id === id ? { ...x, ...patch } : x) })),
      removeLibraryItem: (id) => setS((s) => ({
        library: s.library.filter((x) => x.id !== id),
        // unlink it everywhere it was used
        processes: s.processes.map((p) => ({ ...p, linkedIds: (p.linkedIds ?? []).filter((x) => x !== id), steps: p.steps.map((st) => ({ ...st, resourceIds: (st.resourceIds ?? []).filter((x) => x !== id) })) })),
      })),
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
      resetToStarter: () => setS({ processes: SEED, library: SEED_LIBRARY }),
      setPersonPersona: (id, persona) => setS((s) => ({ people: s.people.map((x) => x.id === id ? { ...x, persona } : x) })),
      addPerson: (name) => setS((s) => ({ people: [...s.people, { id: 'p' + Date.now(), name, note: '', persona: 'performer' }] })),
    }),
    {
      name: 'process-hub-data',
      version: 4,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({ processes: s.processes, people: s.people, library: s.library, glossary: s.glossary }),
      // v2 adds the shared resource library: untouched starter processes get the new version,
      // everything else gets library items assigned automatically
      migrate: (old, version) => {
        const st = (old ?? {}) as { processes?: Process[]; people?: Person[]; library?: LibraryItem[]; glossary?: Term[] }
        if (version < 4 && !st.glossary) st.glossary = SEED_GLOSSARY
        // v3: starter processes and people take the placeholder names from the current starter data
        if (version < 3) {
          if (st.processes) st.processes = st.processes.map((p) => {
            const fresh = SEED.find((x) => x.id === p.id)
            if (!fresh || !p.seeded) return p
            return { ...p, owner: fresh.owner, executiveOwner: fresh.executiveOwner, summary: fresh.summary,
              stages: p.stages.map((sg) => { const f = fresh.stages.find((x) => x.id === sg.id); return f ? { ...sg, place: f.place } : sg }) }
          })
          if (st.people) st.people = START_PEOPLE.concat(st.people.filter((x) => /^p\d/.test(x.id))) // keep people added in Admin
        }
        if (version < 2) {
          const library = st.library ?? SEED_LIBRARY
          const processes = (st.processes ?? SEED).map((p) => {
            const fresh = SEED.find((x) => x.id === p.id)
            if (fresh && p.seeded && p.updatedAt === fresh.updatedAt) return fresh
            if (fresh) {
              // keep the owner's edits, but bring in the curated library links for steps that still exist
              const steps = p.steps.map((x) => x.resourceIds ? x : { ...x, resourceIds: fresh.steps.find((f) => f.id === x.id)?.resourceIds })
              p = { ...p, steps, linkedIds: p.linkedIds ?? fresh.linkedIds, resources: p.resources?.length && !fresh.resources.length ? [] : p.resources }
            }
            return autoAssign(p, library)
          })
          return { ...st, processes, library }
        }
        return st
      },
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
  p === 'owner' ? 'Priya Sharma' : p === 'admin' ? 'Global Admin' : p === 'executive' ? 'Daniel Brooks' : 'Alex Chen'

export const canBuild = (p: Persona) => p === 'owner' || p === 'admin'
export const canEdit = (p: Persona, proc: Process) => p === 'admin' || (p === 'owner' && (proc.owner === 'Priya Sharma' || !proc.seeded))
