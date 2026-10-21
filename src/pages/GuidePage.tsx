import { useEffect } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AppHeader } from '@/components/AppHeader'
import { ProcessHeader } from '@/components/process/ProcessHeader'
import { AboutProcess } from '@/components/process/AboutProcess'
import { ProcessChat } from '@/components/process/ProcessChat'
import TimelineView from '@/pages/guide/TimelineView'
import { useGuide } from '@/lib/guide'
import type { Process } from '@/lib/types'
import { useData } from '@/store/store'
import { useBpmn } from '@/store/bpmn'

/** The Timeline for one process: every stage and step down the left, the chosen step on the right. */
export default function GuidePage() {
  const { id } = useParams()
  const proc = useData((s) => s.processes.find((p) => p.id === id))
  const bpmnLoading = useBpmn((s) => s.status) === 'loading'
  const hydrated = useData((s) => s.hydrated) && !bpmnLoading
  if (!proc) return (
    <div><AppHeader /><p className="p-10 text-on-surface-variant">{hydrated ? 'That process could not be found.' : 'Loading…'} <Link to="/">Back to processes</Link></p></div>
  )
  return <Guide proc={proc} />
}

function Guide({ proc }: { proc: Process }) {
  const library = useData((s) => s.library)
  const run = useGuide(proc, library)
  const [params, setParams] = useSearchParams()
  // a shared link to one step opens on that step
  // and clicking a stage on the process map opens it at that stage's first step (the reader's own, if they have one there)
  const linked = params.get('step')
  const stageNo = params.get('stage')
  useEffect(() => {
    let id = linked && proc.steps.some((x) => x.id === linked) ? linked : undefined
    if (!id && stageNo !== null) {
      const st = run.g.stages[Number(stageNo)]
      id = (st?.usual.find((x) => x.mine) ?? st?.mine[0] ?? st?.all[0])?.st.id
    }
    if (id) run.select(id)
    if (linked || stageNo !== null) setParams({}, { replace: true })
  }, [linked, stageNo]) // eslint-disable-line react-hooks/exhaustive-deps
  const work = proc.steps.filter((x) => x.kind === 'step' || x.kind === 'decision')

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader />
      <ProcessHeader proc={proc} run={run} current="timeline" />
      <div className="h-[calc(100vh-150px)] min-h-[560px] max-[979px]:h-auto">
        {work.length === 0 ? (
          <p className="mx-auto max-w-[760px] p-10 text-on-surface-variant">This process doesn't have any steps yet — {proc.owner} is still completing it.</p>
        ) : (
          <TimelineView proc={proc} run={run} />
        )}
      </div>
      <AboutProcess proc={proc} />
      <ProcessChat proc={proc} onShowStage={(k) => { const st = run.g.stages[k]; const x = st?.usual.find((y) => y.mine) ?? st?.all[0]; if (x) run.select(x.st.id) }} />
    </div>
  )
}
