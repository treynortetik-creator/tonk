import { expect, mock, test } from 'claude-code/testing'

const usage = (rateLimits: unknown[]) => ({ startedAt: 0, context: { window: 200000 }, rateLimits }) as never

let LIMITS: unknown[] = []
const BAND = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 30,
  bodyColumns: 120,
  scroll: { offset: 0, bodyRows: 30 },
  view: {},
} as never

test('no usage data: Tonk draws asleep with no snacks yet', async ($, on) => {
  LIMITS = []
  mock.clock(on)
  mock.store(on)
  on('session.start', ($, e) => e)
  on('session.usage', () => ({ value: usage(LIMITS) }) as never)
  await $.session.start({ cwd: '/tmp', surface: 'terminal' } as never)
  const ui = await $.ui.mount({ plugin: 'tonk', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect(await ui.find({ type: 'Text', text: /no snacks yet/ })).toBeDefined()
  expect(await ui.find({ type: 'Raster', key: 'tonk' })).toBeDefined()
  await ui.unmount()
})

test('weekly usage shows the bar, percent and reset', async ($, on) => {
  LIMITS = [
    { kind: 'five_hour', percentUsed: 23, resetsAt: '2026-10-10T20:00:00Z' },
    { kind: 'seven_day', percentUsed: 68, resetsAt: new Date(2026, 9, 15, 17, 0).toISOString() },
  ]
  mock.clock(on)
  mock.store(on)
  on('session.start', ($, e) => e)
  on('session.usage', () => ({ value: usage(LIMITS) }) as never)
  await $.session.start({ cwd: '/tmp', surface: 'terminal' } as never)
  const ui = await $.ui.mount({ plugin: 'tonk', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect(await ui.find({ type: 'Text', text: /68%/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /resets Thu 5pm/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /5h/ })).toBeDefined()
  await ui.unmount()
})

test('narrow terminals get a one-line text, not a sprite', async ($, on) => {
  LIMITS = []
  mock.clock(on)
  mock.store(on)
  on('session.start', ($, e) => e)
  on('session.usage', () => ({ value: usage(LIMITS) }) as never)
  await $.session.start({ cwd: '/tmp', surface: 'terminal' } as never)
  const narrow = { ...(BAND as object), bodyColumns: 30 } as never
  const ui = await $.ui.mount({ plugin: 'tonk', surface: 'terminal', component: 'AbovePrompt', props: narrow })
  expect(await ui.find({ type: 'Raster' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /TONK/ })).toBeDefined()
  await ui.unmount()
})

const setup = ($: any, on: any, limits: unknown[], entries: Record<string, unknown> = {}) => {
  LIMITS = limits
  mock.clock(on)
  const mem = new Map<string, unknown>(Object.entries(entries))
  on('store.get', ($: unknown, e: { key: string }) => ({ value: mem.get(e.key) }))
  on('session.start', ($: unknown, e: unknown) => e)
  on('session.usage', () => ({ value: usage(LIMITS) }))
  on('turn.complete', () => ({ text: '' }))
  sets.length = 0
  on('store.set', ($: unknown, e: { key: string; value: unknown }) => {
    sets.push({ key: e.key, value: e.value })
    mem.set(e.key, e.value)
    return { value: undefined }
  })
}
const lastPellets = () => sets.filter(s => s.key === 'lastPellets').at(-1)?.value
const sets: Array<{ key: string; value: unknown }> = []
const TURN = { answer: 'ok', durationMs: 1000, isAborted: false, turnId: 't1', reason: 'answer' }

test('a finished turn drops pellets scaled to its tokens', async ($, on) => {
  setup($, on, [{ kind: 'seven_day', percentUsed: 40 }])
  await $.session.start({ cwd: '/tmp', surface: 'terminal' } as never)
  await $.turn.complete({ ...TURN, usage: { input_tokens: 1000, output_tokens: 9000, cache_creation_input_tokens: 0, cache_read_input_tokens: 50000, model: 'x' } } as never)
  expect(lastPellets()).toEqual(expect.objectContaining({ n: 5, source: 'turn-usage' }))
})

test('a turn with no usage data and no deltas is a one-pellet snack', async ($, on) => {
  setup($, on, [])
  await $.session.start({ cwd: '/tmp', surface: 'terminal' } as never)
  await $.turn.complete(TURN as never)
  expect(lastPellets()).toEqual(expect.objectContaining({ n: 1, source: 'snack' }))
})

test('the Spinner site draws the chomper beside the word', async ($, on) => {
  setup($, on, [])
  await $.session.start({ cwd: '/tmp', surface: 'terminal' } as never)
  const ui = await $.ui.mount({
    plugin: 'tonk', surface: 'terminal', component: 'Spinner',
    props: { word: 'Sauteing', message: null, suffix: '…', mode: 'thinking' } as never,
  })
  expect(await ui.find({ type: 'Raster', key: 'tonk-chomp' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Sauteing/ })).toBeDefined()
  await ui.unmount()
})

test('a sharp drop versus the stored percent starts the workout', async ($, on) => {
  setup($, on, [{ kind: 'seven_day', percentUsed: 3 }], { last: { percent: 92, at: 0 } })
  await $.session.start({ cwd: '/tmp', surface: 'terminal' } as never)
  const ui = await $.ui.mount({ plugin: 'tonk', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect(await ui.find({ type: 'Text', text: /RESET! workout time/ })).toBeDefined()
  await ui.unmount()
})

test('100 percent is a food coma with the reset countdown', async ($, on) => {
  setup($, on, [{ kind: 'seven_day', percentUsed: 100, resetsAt: new Date(Date.now() + 50 * 3600_000).toISOString() }])
  await $.session.start({ cwd: '/tmp', surface: 'terminal' } as never)
  const ui = await $.ui.mount({ plugin: 'tonk', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect(await ui.find({ type: 'Text', text: /food coma/ })).toBeDefined()
  await ui.unmount()
})

const MIN = 60_000
const idleSetup = ($: any, on: any, limits: unknown[]) => {
  LIMITS = limits
  const clock = mock.clock(on, { now: 1_000_000 })
  const mem = new Map<string, unknown>()
  on('store.get', ($: unknown, e: { key: string }) => ({ value: mem.get(e.key) }))
  on('store.set', ($: unknown, e: { key: string; value: unknown }) => {
    mem.set(e.key, e.value)
    return { value: undefined }
  })
  on('session.start', ($: unknown, e: unknown) => e)
  on('session.usage', () => ({ value: usage(LIMITS) }))
  on('turn.start', ($: unknown, e: { turnId: string }) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  return { clock, mem }
}
const band = ($: any) => $.ui.mount({ plugin: 'tonk', surface: 'terminal', component: 'AbovePrompt', props: BAND })

test('idle: bored at 2 min, frantic at 5, banging at 10', async ($, on) => {
  const { clock } = idleSetup($, on, [{ kind: 'seven_day', percentUsed: 50 }])
  await $.session.start({ cwd: '/tmp', surface: 'terminal' } as never)
  const ui = await band($)
  expect(await ui.find({ type: 'Text', text: /hello\?/ })).toBeUndefined()
  await clock.advance(2 * MIN)
  const u2 = await band($)
  expect(await u2.find({ type: 'Text', text: /hello\?/ })).toBeDefined()
  await clock.advance(3 * MIN)
  expect(await (await band($)).find({ type: 'Text', text: /FEED/ })).toBeDefined()
  await clock.advance(5 * MIN)
  expect(await (await band($)).find({ type: 'Text', text: /BANG/ })).toBeDefined()
})

test('idle: a turn resets the timer', async ($, on) => {
  const { clock, mem } = idleSetup($, on, [{ kind: 'seven_day', percentUsed: 50 }])
  await $.session.start({ cwd: '/tmp', surface: 'terminal' } as never)
  await band($) // first render starts (and spends) the can intro
  await clock.advance(11 * MIN)
  expect(await (await band($)).find({ type: 'Text', text: /BANG/ })).toBeDefined()
  await $.turn.start({ text: 'hi', turnId: 't1' } as never)
  await $.turn.complete({ ...TURN } as never)
  expect(mem.get('lastActivity')).toBe(1_000_000 + 11 * MIN)
  const after = await band($)
  expect(await after.find({ type: 'Text', text: /BANG|FEED|hello\?/ })).toBeUndefined()
  await clock.advance(2 * MIN)
  expect(await (await band($)).find({ type: 'Text', text: /hello\?/ })).toBeDefined()
})

test('idle: food coma ignores the timer', async ($, on) => {
  const { clock } = idleSetup($, on, [{ kind: 'seven_day', percentUsed: 100, resetsAt: new Date(Date.now() + 50 * 3600_000).toISOString() }])
  await $.session.start({ cwd: '/tmp', surface: 'terminal' } as never)
  await clock.advance(11 * MIN)
  const ui = await band($)
  expect(await ui.find({ type: 'Text', text: /food coma/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /BANG|FEED|hello\?/ })).toBeUndefined()
})

const OOPS = /oops\. dinner is served/

test('intro: plays once per session, not on every render or turn', async ($, on) => {
  const { clock } = idleSetup($, on, [{ kind: 'seven_day', percentUsed: 50 }])
  await $.session.start({ cwd: '/tmp', surface: 'terminal' } as never)
  expect(await (await band($)).find({ type: 'Text', text: OOPS })).toBeDefined()
  await clock.advance(500)
  expect(await (await band($)).find({ type: 'Text', text: OOPS })).toBeDefined() // same intro still playing
  await clock.advance(3000)
  expect(await (await band($)).find({ type: 'Text', text: OOPS })).toBeUndefined()
  await $.turn.start({ text: 'hi', turnId: 't1' } as never)
  await $.turn.complete({ ...TURN } as never)
  await clock.advance(5000)
  expect(await (await band($)).find({ type: 'Text', text: OOPS })).toBeUndefined()
})

test('intro: a turn that starts mid-intro skips it', async ($, on) => {
  const { clock } = idleSetup($, on, [{ kind: 'seven_day', percentUsed: 50 }])
  await $.session.start({ cwd: '/tmp', surface: 'terminal' } as never)
  await band($)
  await clock.advance(400)
  await $.turn.start({ text: 'hi', turnId: 't1' } as never)
  expect(await (await band($)).find({ type: 'Text', text: OOPS })).toBeUndefined()
})

test('intro: plays again after the reset workout ends', async ($, on) => {
  const { clock, mem } = idleSetup($, on, [{ kind: 'seven_day', percentUsed: 3 }])
  mem.set('last', { percent: 92, at: 0 })
  await $.session.start({ cwd: '/tmp', surface: 'terminal' } as never)
  const w = await band($)
  expect(await w.find({ type: 'Text', text: /RESET! workout time/ })).toBeDefined()
  expect(await w.find({ type: 'Text', text: OOPS })).toBeUndefined()
  await clock.advance(6100)
  expect(await (await band($)).find({ type: 'Text', text: OOPS })).toBeDefined()
  await clock.advance(3000)
  expect(await (await band($)).find({ type: 'Text', text: OOPS })).toBeUndefined()
})

test('intro: a food coma never gets one', async ($, on) => {
  idleSetup($, on, [{ kind: 'seven_day', percentUsed: 100, resetsAt: new Date(Date.now() + 50 * 3600_000).toISOString() }])
  await $.session.start({ cwd: '/tmp', surface: 'terminal' } as never)
  const ui = await band($)
  expect(await ui.find({ type: 'Text', text: OOPS })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /food coma/ })).toBeDefined()
})
