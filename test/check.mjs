// Developer self-check for office-script/parseBpmn.ts — not needed to deploy.
// Needs Node 23.6+ (runs TypeScript directly). BPMN files stay outside the repo:
//   node test/check.mjs "/path/FS07 - ….bpmn" "/path/FS11 - ….bpmn"
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import assert from 'node:assert/strict'

const files = process.argv.slice(2)
if (!files.length) { console.log('usage: node test/check.mjs <file.bpmn>…'); process.exit(1) }

// the Office Script has no exports: copy it with one added, then import it
const src = readFileSync(new URL('../office-script/parseBpmn.ts', import.meta.url), 'utf8')

// Office Scripts rules the Code Editor enforces (learn.microsoft.com/office/dev/scripts/develop/typescript-restrictions):
// array callbacks must be inline arrow functions, no `any`, no eval, no reserved identifiers
const ARRAY_FN = /\.(map|filter|find|findIndex|some|every|forEach|reduce|sort)\(\s*(function\b|[A-Za-z_$][\w$]*\s*[,)])/
assert.ok(!ARRAY_FN.test(src), `array callback must be an arrow function: ${src.match(ARRAY_FN)?.[0]}`)
assert.ok(!/:\s*any\b|<any>|\bas any\b/.test(src), 'no `any` type')
assert.ok(!/\beval\(|\bconsole\b/.test(src), 'no eval / console')
const tmp = join(mkdtempSync(join(tmpdir(), 'parse-')), 'parseBpmn.ts')
writeFileSync(tmp, src + '\nexport { main }\n')
const { main } = await import(tmp)

// a broken file reports an error instead of throwing
assert.match(JSON.parse(main(null, '<html/>', 'x.bpmn')).error, /not a BPMN/)

// a tiny diagram: lane → role, named paths → decision branches, text is HTML-escaped in the detail
const tiny = `<?xml version="1.0"?><definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL">
<process id="p"><laneSet><lane id="l" name="Clerk &amp; Co"><flowNodeRef>s</flowNodeRef><flowNodeRef>a</flowNodeRef><flowNodeRef>g</flowNodeRef><flowNodeRef>b</flowNodeRef><flowNodeRef>e</flowNodeRef></lane></laneSet>
<startEvent id="s" name="Form arrives"/><task id="a" name="Check form"><documentation>Use &lt;b&gt;care</documentation></task>
<exclusiveGateway id="g"/><task id="b" name="Fix it"/><endEvent id="e" name="Filed"/>
<sequenceFlow id="f1" sourceRef="s" targetRef="a"/><sequenceFlow id="f2" sourceRef="a" targetRef="g"/>
<sequenceFlow id="f3" sourceRef="g" targetRef="e" name="OK"/><sequenceFlow id="f4" sourceRef="g" targetRef="b" name="Wrong"/><sequenceFlow id="f5" sourceRef="b" targetRef="a"/></process></definitions>`
const t = JSON.parse(main(null, tiny, 'AB12 - Tiny test.bpmn'))
assert.equal(t.code, 'AB12'); assert.equal(t.title, 'Tiny test')
assert.deepEqual(t.roles, ['Clerk & Co']); assert.deepEqual(t.triggers, ['Form arrives']); assert.deepEqual(t.outcomes, ['Filed'])
const dec = t.rows.find((r) => r.k === 'decision')
assert.equal(dec.title, 'OK or Wrong?'); assert.equal(dec.hint, 'OK → Finish: Filed · Wrong → Fix it')
assert.ok(t.rows.find((r) => r.k === 'task' && r.title === 'Check form').detail.includes('<p>Use &lt;b&gt;care</p>'))

for (const f of files) {
  const text = main(null, readFileSync(f, 'utf8'), basename(f))
  const p = JSON.parse(text)
  assert.ok(!p.error, p.error)
  const steps = p.rows.filter((r) => r.k !== 'stage')
  const stages = p.rows.filter((r) => r.k === 'stage')
  assert.ok(text.length < 60000, `JSON is ${text.length} chars`)
  assert.ok(p.code && p.title && p.roles.length && p.triggers.length && p.outcomes.length)
  assert.equal(steps.length, p.stepCount)
  assert.equal(stages.length, p.stageCount)
  assert.ok(steps.every((s) => s.title && s.role && s.num), 'every step has a title, role and number')
  assert.ok(steps.filter((s) => s.k === 'decision').every((s) => s.hint.split(' · ').length >= 2), 'decisions have 2+ branches')
  assert.ok(!/<script|onerror=/i.test(text), 'detail HTML is escaped')
  assert.deepEqual(p.rows.map((r) => r.n), p.rows.map((_, i) => i))

  console.log(`\n=== ${p.code} · ${p.title}  (${text.length} chars, ${p.stepCount} steps, ${p.stageCount} stages)`)
  console.log(`owner: ${p.owner} <${p.ownerEmail}>\nroles: ${p.roles.join(' | ')}`)
  console.log(`starts when: ${p.triggers.map((t) => t.replace(/\n/g, ' ')).join(' | ')}`)
  console.log(`summary: ${p.summary.slice(0, 160)}…`)
  for (const r of p.rows) {
    if (r.k === 'stage') { console.log(`\n  STAGE ${r.num}: ${r.title} (${r.count})`); continue }
    console.log(`   ${r.num.padEnd(5)} [${r.k}] ${r.title}  — ${r.role}${r.detail.includes('<h4>Documents') ? '  📄' : ''}${r.detail.includes('How to do it') ? '  ✎' : ''}`)
    if (r.hint) console.log(`           ${r.hint}`)
  }
  console.log(`\n  done when: ${p.outcomes.map((t) => t.replace(/\n/g, ' ')).join(' | ')}`)
  if (p.warnings.length) console.log(`  warnings: ${p.warnings.join(' | ')}`)
}
console.log('\nall checks passed')
