// W6's repair choice, switched on. In the starter it is commented out, so no ordinary test can reach
// it. This test makes a throw-away copy of BookingForm.tsx with the W6 part switched on exactly as the
// instructions say (remove the // in front of RepairChoice, replace the placeholder line), and checks
// that a repair the user ticked stays ticked when the form comes back after a failed send. It also
// checks the server side: every "not saved" answer hands the ticked repairs back to the form.
//
// Not tested here: the two commented W6 lines in src/tasks/book-slot/createBooking.ts (the `const
// repairs = ...` line and `repairs,` in payload.create). They save the ticked repairs, and that only
// works once the bookings collection has a `repairs` relationship, which W6 itself adds. Until then
// they stay commented out and untested.
import { randomUUID } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement, type ComponentType } from 'react'
import { renderToString } from 'react-dom/server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { getTestPayload, resetCollections } from '../setup/payload'
import { refuseUnlessThrowAwayTestDatabase } from '../setup/safety'
import { createBooking } from '../../src/tasks/book-slot/createBooking'
import { typedValues } from '../../src/tasks/book-slot/typedValues'

refuseUnlessThrowAwayTestDatabase()

const root = fileURLToPath(new URL('../..', import.meta.url))
const PLACEHOLDER = '{/* W6: <RepairChoice repairs={props.repairs} /> */}'

/** BookingForm.tsx with W6 switched on, as a student would do it, plus exports for this test. */
function switchedOn(source: string): string {
  const lines = source.split('\n')
  const start = lines.findIndex((line) => line.startsWith('// function RepairChoice('))
  const end = lines.findIndex((line, i) => i > start && line === '// }')
  if (start < 0 || end < 0) throw new Error('The W6 RepairChoice block was not found in BookingForm.tsx')
  for (let i = start; i <= end; i++) lines[i] = lines[i].replace(/^\/\/ ?/, '')
  // "Replace the whole line": the line in the form that holds only the placeholder (the instructions
  // above it quote the same text, and stay as they are).
  const placeholder = lines.findIndex((line) => line.trim() === PLACEHOLDER)
  if (placeholder < 0) throw new Error('The W6 placeholder line was not found in BookingForm.tsx')
  lines[placeholder] = lines[placeholder].replace(PLACEHOLDER, '<RepairChoice repairs={props.repairs} />')
  // The copy lives outside the project, where the project's JSX setting does not reach it: the
  // React import lets its JSX compile there too.
  return `import * as React from 'react'\n${lines.join('\n')}\nexport { RepairChoice }\nvoid React\n`
}

describe('W6 switched on: the ticked repairs survive a failed send', () => {
  let folder: string
  let w6: {
    RepairChoice: ComponentType<{ repairs: { id: number; name: string; price: number }[] }>
    SentValues: React.Context<unknown>
    BookingForm: ComponentType<{ clinic: string; slots: { id: number; label: string; placesLeft: number }[]; requestId: string; repairs: { id: number; name: string; price: number }[] }>
  }
  let p: Payload
  let slotId: number
  const repairs = [{ id: 1, name: 'Check', price: 10 }, { id: 2, name: 'Each small repair', price: 5 }, { id: 3, name: 'Full service', price: 45 }]

  beforeAll(async () => {
    folder = mkdtempSync(path.join(tmpdir(), 'bw-starter-w6-'))
    const file = path.join(folder, 'BookingForm.w6.tsx')
    writeFileSync(file, switchedOn(readFileSync(path.join(root, 'src/components/site/BookingForm.tsx'), 'utf8')))
    w6 = await import(/* @vite-ignore */ file)
    p = await getTestPayload()
  })
  beforeEach(async () => {
    await resetCollections(['bookings', 'timeSlots', 'clinics', 'throttle'])
    const clinic = await p.create({ collection: 'clinics', data: { name: 'Test clinic', slug: 'test-clinic', day: 'Saturday', startTime: '15:00', endTime: '17:00', summary: 'Test instance.' } })
    slotId = (await p.create({ collection: 'timeSlots', data: { clinic: clinic.id, startsAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(), places: 1 } })).id
  })
  afterAll(async () => {
    rmSync(folder, { recursive: true, force: true })
    await resetCollections(['bookings', 'timeSlots', 'clinics', 'throttle'])
  })

  const checked = (html: string) => [...html.matchAll(/<input type="checkbox"[^>]*>/g)].filter(([tag]) => /checked=""/.test(tag)).map(([tag]) => /value="(\d+)"/.exec(tag)?.[1])
  // The switched-on repair choice inside the form's "what was sent last time".
  const render = (sent: unknown) =>
    renderToString(createElement(w6.SentValues, { value: sent }, createElement(w6.RepairChoice, { repairs })))

  it('the switched-on form shows the repair choice inside the form, after the note and before the button', () => {
    const html = renderToString(createElement(w6.BookingForm, { clinic: 'test-clinic', slots: [{ id: 1, label: 'Saturday 10 October, 15:00', placesLeft: 2 }], requestId: randomUUID(), repairs }))
    expect(html).toMatch(/<form[^>]*>.*name="note".*<legend[^>]*>.*Repairs.*name="repairs".*Book this slot.*<\/form>/s)
    expect(html.match(/<input type="checkbox"[^>]*name="repairs"/g)).toHaveLength(3)
  })

  it('shows each repair by name, none ticked on a fresh form', () => {
    const html = render({ timeSlot: '', name: '', email: '', note: '' })
    for (const repair of repairs) expect(html).toContain(repair.name)
    expect(html.match(/<input type="checkbox"[^>]*name="repairs"/g)).toHaveLength(3)
    expect(checked(html)).toEqual([])
  })

  const form = (fields: Record<string, string | string[]>) => {
    const data = new FormData()
    const all = { clinic: 'test-clinic', requestId: randomUUID(), name: 'Test Person', email: 'test@campuscycle.example', timeSlot: String(slotId), ...fields }
    for (const [name, value] of Object.entries(all)) for (const one of [value].flat()) data.append(name, one)
    return data
  }
  const send = (fields: Record<string, string | string[]>) => createBooking(form(fields), { payload: p, ip: `198.51.100.${Math.floor(Math.random() * 200) + 1}`, now: new Date() })

  it('after a field problem, a full slot and a lost answer, the ticked repairs come back ticked', async () => {
    // A field problem (the server's answer).
    const invalid = await send({ email: 'nope', repairs: ['1', '3'] })
    expect(invalid).toMatchObject({ ok: false, field: 'email', values: { repairs: ['1', '3'] } })
    expect(checked(render(!invalid.ok && invalid.values))).toEqual(['1', '3'])

    // A full slot (the server's answer): someone else took the one place first.
    expect((await send({})).ok).toBe(true)
    const full = await send({ repairs: ['2'] })
    expect(full).toMatchObject({ ok: false, message: 'This slot is full. Choose another time.', values: { timeSlot: '', repairs: ['2'] } })
    expect(checked(render(!full.ok && full.values))).toEqual(['2'])

    // No answer at all: the form keeps what it sent itself.
    const lost = typedValues(form({ repairs: ['1', '2'] }))
    expect(checked(render(lost))).toEqual(['1', '2'])
  })

  it('hands back only repair ids, and saves nothing from them (the whitelist still holds before W6)', async () => {
    const result = await send({ email: 'nope', repairs: ['2', 'x', '<b>', '3'] })
    expect(result).toMatchObject({ values: { repairs: ['2', '3'] } })
    const saved = await send({ repairs: ['2'] })
    expect(saved.ok).toBe(true)
    const [booking] = (await p.find({ collection: 'bookings', depth: 0 })).docs
    expect(booking).not.toHaveProperty('repairs')
  })
})
