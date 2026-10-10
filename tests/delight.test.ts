import { describe, expect, test } from 'claude-code/testing'

import {
  EVENT_IDS, EVENT_MAX_GAP_MS, EVENT_MIN_GAP_MS, EVENT_MS, GOLDEN_QUIP, INTRO_MS, JIGGLE_MS, MICRO, OCTOBER,
  activeEvent, burstEndMs, canIntro, eventSchedule, eventSeed, introFrameIndex, introProgress, jiggleProgress,
  microProgress, microStart, microState, pickEvent,
} from '../hooks/core.ts'
import { bandFrame, type ArtApi } from '../hooks/render.ts'
import { H, SEQUENCE, W, buildFrame } from '../hooks/sprites.ts'

const solid = (c: string) => Array.from({ length: H }, () => c.repeat(W))
const tag = (rows: string[]) => rows[0]![0]!

/** A fake art export that paints each feature in its own letter, so tests can see which one drew. */
const FAKE: ArtApi = {
  INTRO_FRAMES: 4,
  JIGGLE_FRAMES: 3,
  DRAINED_CAN: true,
  EVENTS: { wash: 4, treasure: 4, lid_hat: 4, juggle: 4, sneeze: 3, look_up: 3, golden: 4, doze: 4, bandana_cape: 4 },
  buildEventFrame: () => solid('E'),
  buildFrame: (_s, _f, x = {}) =>
    solid(x.drained ? 'd' : x.intro !== undefined ? 'i' : x.jiggle !== undefined ? 'j' : x.blink ? 'b' : x.tail ? 't' : x.ear ? 'e' : x.poke ? 'p' : 'a'),
}

describe('can intro', () => {
  test('plays for INTRO_MS from its start, then is over', () => {
    expect(introProgress(null, 100)).toBeNull()
    expect(introProgress(1000, 1000)).toBe(0)
    expect(Math.abs(introProgress(1000, 1000 + INTRO_MS / 2)! - 0.5)).toBeLessThan(1e-6)
    expect(introProgress(1000, 1000 + INTRO_MS)).toBeNull()
    expect(INTRO_MS).toBeGreaterThanOrEqual(2000)
    expect(INTRO_MS).toBeLessThanOrEqual(3000)
  })
  test('frame index walks the sequence and holds the last frame', () => {
    expect([0, 0.3, 0.6, 0.99].map(p => introFrameIndex(p, 4))).toEqual([0, 1, 2, 3])
    expect(introFrameIndex(0.5, 1)).toBe(0)
  })
  test('coma and workout get no intro', () => {
    expect(canIntro('coma')).toBe(false)
    expect(canIntro('workout')).toBe(false)
    expect(canIntro('round')).toBe(true)
  })
  test('bandFrame draws intro frames while it plays, idle after', () => {
    const during = bandFrame({ state: 'round', now: 1500, isWorking: false, introStart: 1000 }, FAKE)
    expect(during.mode).toBe('intro')
    expect(tag(during.rows)).toBe('i')
    expect(bandFrame({ state: 'round', now: 1000 + INTRO_MS, isWorking: false, introStart: 1000 }, FAKE).mode).toBe('idle')
  })
  test('a turn mid-intro wins: the chomp draws, not the intro', () => {
    const f = bandFrame({ state: 'round', now: 1500, isWorking: true, introStart: 1000 }, FAKE)
    expect(f.mode).toBe('working')
  })
  test('coma ignores the intro and shows the drained can when exported', () => {
    const f = bandFrame({ state: 'coma', now: 1500, isWorking: false, introStart: 1000 }, FAKE)
    expect(f.mode).toBe('idle')
    expect(tag(f.rows)).toBe('d')
    const plain = bandFrame({ state: 'coma', now: 1500, isWorking: false, introStart: 1000 }, {})
    expect(plain.rows).toEqual(buildFrame('coma', SEQUENCE.coma[Math.floor(1500 / 250) % SEQUENCE.coma.length]!))
  })
})

describe('belly jiggle', () => {
  const burst = { start: 10_000, n: 6 }
  test('starts when the last pellet lands and lasts about half a second', () => {
    const end = burstEndMs(burst)
    expect(jiggleProgress(burst, end - 1)).toBeNull()
    expect(jiggleProgress(burst, end)).toBe(0)
    expect(Math.abs(jiggleProgress(burst, end + JIGGLE_MS / 2)! - 0.5)).toBeLessThan(1e-6)
    expect(jiggleProgress(burst, end + JIGGLE_MS)).toBeNull()
    expect(JIGGLE_MS).toBeGreaterThanOrEqual(400)
    expect(JIGGLE_MS).toBeLessThanOrEqual(600)
  })
  test('bandFrame jiggles only inside that window', () => {
    const end = burstEndMs(burst)
    const scene = (now: number) => bandFrame({ state: 'huge', now, isWorking: false, burst }, FAKE)
    expect(scene(end + 100).mode).toBe('jiggle')
    expect(tag(scene(end + 100).rows)).toBe('j')
    expect(scene(end + JIGGLE_MS + 50).mode).toBe('idle')
    expect(scene(end - 200).mode).toBe('burst')
  })
  test('coma does not jiggle', () => {
    expect(bandFrame({ state: 'coma', now: burstEndMs(burst) + 100, isWorking: false, burst }, FAKE).mode).toBe('idle')
  })
})

describe('idle micro-animations', () => {
  test('deterministic: same time, same answer, across a long run', () => {
    for (let t = 0; t < 120_000; t += 125) expect(microState(t)).toEqual(microState(t))
  })
  test('blinks land every 3 to 6 seconds', () => {
    const starts = Array.from({ length: 200 }, (_, i) => microStart('blink', i))
    for (let i = 1; i < starts.length; i++) {
      const gap = starts[i]! - starts[i - 1]!
      expect(gap).toBeGreaterThanOrEqual(3000)
      expect(gap).toBeLessThanOrEqual(6000)
    }
  })
  test('blink lasts its duration and is off in between', () => {
    const s = microStart('blink', 3)
    expect(microProgress('blink', s)).toBe(0)
    expect(microProgress('blink', s + MICRO.blink.durMs - 1)).not.toBeNull()
    expect(microProgress('blink', s + MICRO.blink.durMs)).toBeNull()
    expect(microProgress('blink', s - 1)).toBeNull()
  })
  test('tail swish and ear twitch are rarer than blinks, and tail alternates two poses', () => {
    let blinks = 0, tails = 0, ears = 0
    const poses = new Set<number>()
    for (let t = 0; t < 600_000; t += 125) {
      const m = microState(t)
      if (m.blink) blinks++
      if (m.tail) { tails++; poses.add(m.tail) }
      if (m.ear) ears++
    }
    expect(blinks).toBeGreaterThan(0)
    expect(tails).toBeGreaterThan(0)
    expect(ears).toBeGreaterThan(0)
    expect([...poses].sort()).toEqual([1, 2])
    expect(ears).toBeLessThan(blinks)
  })
  test('bandFrame draws a blink at a blink time, plain idle otherwise, and never on sleepers', () => {
    const t = microStart('blink', 5)
    const on = bandFrame({ state: 'round', now: t, isWorking: false }, FAKE)
    expect(on.mode).toBe('idle')
    // find a time with no micro layer active
    let quiet = 0
    while (microState(quiet).blink || microState(quiet).tail || microState(quiet).ear) quiet += 125
    expect(tag(bandFrame({ state: 'round', now: quiet, isWorking: false }, FAKE).rows)).not.toMatch(/[bte]/)
    expect(tag(on.rows)).toBe('b')
    expect(tag(bandFrame({ state: 'coma', now: t, isWorking: false }, { ...FAKE, DRAINED_CAN: false }).rows)).not.toMatch(/[bte]/)
  })
  test('redraw stays within the throttle: micro events are at least one 250 ms step wide', () => {
    for (const k of ['blink', 'tail', 'ear'] as const) expect(MICRO[k].durMs).toBeGreaterThanOrEqual(250)
  })
})

describe('fallback when an export is missing', () => {
  const states = ['asleep', 'skinny', 'snacking', 'round', 'huge', 'bloated', 'coma', 'workout'] as const
  const BROKEN: ArtApi[] = [
    {},
    { INTRO_FRAMES: 4 },
    { EVENTS: ['wash'] },
    { EVENTS: ['wash'], buildEventFrame: () => { throw new Error('boom') } },
    { ...FAKE, buildFrame: () => { throw new Error('boom') } },
    { ...FAKE, buildFrame: () => ['short'] },
  ]
  test('bandFrame returns a full W x H frame and never throws, whatever is missing', () => {
    for (const art of BROKEN)
      for (const state of states)
        for (let now = 0; now < 200_000; now += 7_919) {
          const f = bandFrame({ state, now, isWorking: false, introStart: now - 500, burst: { start: now - 2600, n: 4 }, idleMs: now % 150_000, eventSeed: 7, month: OCTOBER }, art)
          expect(f.rows.length).toBe(H)
          expect(f.rows.every(r => r.length === W)).toBe(true)
        }
  })
  test('missing intro art means the plain idle frame', () => {
    const f = bandFrame({ state: 'round', now: 1500, isWorking: false, introStart: 1000 }, {})
    expect(f.mode).toBe('idle')
  })
  test('an event missing from EVENTS is never scheduled', () => {
    const only = new Set(['wash'])
    const hits = new Set<string>()
    for (let seed = 0; seed < 200; seed++) for (const e of eventSchedule(seed, 0, 6, 3, only)) hits.add(e.event)
    expect([...hits]).toEqual(['wash']) // it can never follow itself, so only one slot fills
    const two = new Set<string>()
    for (let seed = 0; seed < 200; seed++) for (const e of eventSchedule(seed, 0, 6, 3, new Set(['wash', 'doze']))) two.add(e.event)
    expect([...two].sort()).toEqual(['doze', 'wash'])
  })
})

describe('delight events', () => {
  const sched = (seed: number, month = 3) => eventSchedule(seed, 0, 6, month)

  test('gaps sit between 45 and 120 s of idle (plus the previous event)', () => {
    for (let seed = 0; seed < 300; seed++) {
      let end = 0
      for (const e of sched(seed)) {
        expect(e.start - end).toBeGreaterThanOrEqual(EVENT_MIN_GAP_MS - 1)
        expect(e.start - end).toBeLessThanOrEqual(EVENT_MAX_GAP_MS + 1)
        end = e.start + EVENT_MS[e.event]
      }
    }
  })
  test('never the same event twice in a row', () => {
    for (let seed = 0; seed < 500; seed++) {
      const s = sched(seed)
      for (let i = 1; i < s.length; i++) expect(s[i]!.event).not.toBe(s[i - 1]!.event)
    }
  })
  test('weights: commons beat the rest, golden is about 1 in 50', () => {
    const count: Record<string, number> = {}
    let total = 0
    for (let seed = 0; seed < 4000; seed++) for (const e of sched(seed, OCTOBER)) { count[e.event] = (count[e.event] ?? 0) + 1; total++ }
    const c = (id: string) => count[id] ?? 0
    const commons = ['look_up', 'wash', 'sneeze', 'doze'].map(c)
    const mids = ['treasure', 'lid_hat', 'juggle', 'bandana_cape'].map(c)
    expect(Math.min(...commons)).toBeGreaterThan(Math.max(...mids))
    const golden = c('golden') / total
    expect(golden).toBeGreaterThan(0.01)
    expect(golden).toBeLessThan(0.04)
    expect(EVENT_IDS.every(id => c(id) > 0)).toBe(true)
  })
  test('bandana_cape only in October', () => {
    for (let seed = 0; seed < 500; seed++) {
      for (let month = 0; month < 12; month++) {
        const has = sched(seed, month).some(e => e.event === 'bandana_cape')
        if (month !== OCTOBER) expect(has).toBe(false)
      }
    }
    expect(Array.from({ length: 500 }, (_, s) => sched(s, OCTOBER)).flat().some(e => e.event === 'bandana_cape')).toBe(true)
    expect(pickEvent(0.999, null, 2)).not.toBe('bandana_cape')
  })
  test('deterministic in the seed, different across seeds and session ids', () => {
    expect(sched(42)).toEqual(sched(42))
    expect(sched(1)).not.toEqual(sched(2))
    expect(eventSeed('abc', 5000)).toBe(eventSeed('abc', 5000))
    expect(eventSeed('abc', 5000)).not.toBe(eventSeed('abd', 5000))
  })
  test('activeEvent matches the schedule', () => {
    const e = sched(9)[0]!
    expect(activeEvent(9, 0, e.start - 1, 3)).toBeNull()
    expect(activeEvent(9, 0, e.start + 10, 3)?.event).toBe(e.event)
    expect(activeEvent(9, 0, e.start + EVENT_MS[e.event], 3)?.event).not.toBe(e.event)
  })

  // priority order, using a seed with an event we can aim at
  const seed = 9
  const first = sched(seed)[0]!
  const mid = first.start + 200
  const sceneAt = (extra: object) => bandFrame({ state: 'round', now: mid, isWorking: false, idleMs: mid, eventSeed: seed, month: 3, ...extra }, FAKE)

  test('an event plays when idle, in the gap before pokes', () => {
    expect(first.start).toBeLessThan(120_000 + 1)
    expect(sceneAt({}).mode).toBe('event')
    expect(sceneAt({}).event).toBe(first.event)
  })
  test('priority: turn, burst, intro, coma and pokes all beat events', () => {
    expect(sceneAt({ isWorking: true }).mode).toBe('working')
    expect(sceneAt({ burst: { start: mid - 100, n: 5 } }).mode).toBe('burst')
    expect(sceneAt({ introStart: mid - 100 }).mode).toBe('intro')
    expect(bandFrame({ state: 'coma', now: mid, isWorking: false, idleMs: mid, eventSeed: seed, month: 3 }, FAKE).mode).toBe('idle')
    // idle past 2 minutes: poke tier wins even with an event on the schedule
    const late = sched(seed).find(e => e.start > 120_000)
    const when = late ? late.start + 100 : 130_000
    const f = bandFrame({ state: 'round', now: when, isWorking: false, idleMs: when, eventSeed: seed, month: 3 }, { ...FAKE, POKE_FRAMES: { bored: 2, frantic: 2, bang: 2 } })
    expect(f.mode).toBe('poke')
  })
  test('no event without a seed or without idle time', () => {
    expect(bandFrame({ state: 'round', now: mid, isWorking: false, idleMs: mid }, FAKE).mode).not.toBe('event')
    expect(bandFrame({ state: 'round', now: mid, isWorking: false, eventSeed: seed }, FAKE).mode).not.toBe('event')
  })
  test('golden is flagged so the caption can sparkle', () => {
    expect(GOLDEN_QUIP).toContain('golden snack')
    let found = false
    for (let s = 0; s < 3000 && !found; s++) {
      const g = sched(s).find(e => e.event === 'golden' && e.start + 100 < 120_000)
      if (!g) continue
      const now = g.start + 100
      const f = bandFrame({ state: 'round', now, isWorking: false, idleMs: now, eventSeed: s, month: 3 }, FAKE)
      expect(f.event).toBe('golden')
      found = true
    }
    expect(found).toBe(true)
  })
})
