import { describe, expect, test } from 'claude-code/testing'

import {
  BANG_MS, BORED_MS, FRANTIC_MS, MAX_PELLETS, activeTier, bar, burstFrame, compactLine, detectReset, findWindow, formatCountdown, formatReset,
  makeCaption, pelletsForDelta, pelletsForTokens, pelletsForTurn, pickState, pokeTier, streamFrame, turnTokens,
} from '../hooks/core.ts'
import { bandFrame, chompFrame } from '../hooks/render.ts'
import { FRAME_COUNT, H, MOUTH, PALETTE, W, buildFrame, toCellGrid, toRasterCells } from '../hooks/sprites.ts'

describe('state selection', () => {
  test('boundaries land in the next state', () => {
    const cases: Array<[number, string]> = [
      [0, 'skinny'], [9.9, 'skinny'], [10, 'snacking'], [34.9, 'snacking'], [35, 'round'],
      [59.9, 'round'], [60, 'huge'], [79.9, 'huge'], [80, 'bloated'], [99.9, 'bloated'], [100, 'coma'], [140, 'coma'],
    ]
    for (const [p, s] of cases) expect(pickState(p)).toBe(s)
  })

  test('missing or junk data means asleep', () => {
    expect(pickState(undefined)).toBe('asleep')
    expect(pickState(null)).toBe('asleep')
    expect(pickState(Number.NaN)).toBe('asleep')
  })

  test('findWindow picks seven_day and five_hour, ignores the rest', () => {
    const limits = [
      { kind: 'five_hour', percentUsed: 23.5, resetsAt: '2026-10-10T20:00:00Z' },
      { kind: 'seven_day', percentUsed: 68, resetsAt: '2026-10-15T00:00:00Z' },
      { kind: 'spend_limit', percentUsed: 5 },
    ]
    expect(findWindow(limits, 'seven_day')?.percent).toBe(68)
    expect(findWindow(limits, 'five_hour')?.percent).toBe(23.5)
    expect(findWindow([], 'seven_day')).toBeUndefined()
    expect(findWindow(undefined, 'seven_day')).toBeUndefined()
  })
})

describe('reset detection', () => {
  test('a sharp drop is a reset', () => {
    expect(detectReset({ percent: 92 }, { percent: 3 })).toBe(true)
    expect(detectReset({ percent: 40 }, { percent: 20 })).toBe(true)
  })
  test('small movement and growth are not', () => {
    expect(detectReset({ percent: 40 }, { percent: 41 })).toBe(false)
    expect(detectReset({ percent: 40 }, { percent: 21 })).toBe(false)
    expect(detectReset({ percent: 5 }, { percent: 5 })).toBe(false)
  })
  test('no stored value or no new value is not a reset', () => {
    expect(detectReset(undefined, { percent: 3 })).toBe(false)
    expect(detectReset({ percent: 50 }, undefined)).toBe(false)
  })
  test('the window rolling forward with a lower percent is a reset', () => {
    expect(detectReset(
      { percent: 30, resetsAt: '2026-10-10T00:00:00Z' },
      { percent: 12, resetsAt: '2026-10-17T00:00:00Z' },
    )).toBe(true)
    expect(detectReset(
      { percent: 30, resetsAt: '2026-10-10T00:00:00Z' },
      { percent: 31, resetsAt: '2026-10-17T00:00:00Z' },
    )).toBe(false)
  })
})

describe('captions', () => {
  test('bar fills proportionally', () => {
    expect(bar(68)).toBe('███████░░░')
    expect(bar(0)).toBe('░░░░░░░░░░')
    expect(bar(100)).toBe('██████████')
    expect(bar(250)).toBe('██████████')
  })
  test('reset time formats in local time', () => {
    expect(formatReset(new Date(2026, 9, 15, 17, 0).toISOString())).toBe('Thu 5pm')
    expect(formatReset(new Date(2026, 9, 15, 9, 30).toISOString())).toBe('Thu 9:30am')
    expect(formatReset(new Date(2026, 9, 15, 0, 0).toISOString())).toBe('Thu 12am')
    expect(formatReset(undefined)).toBeUndefined()
    expect(formatReset('nope')).toBeUndefined()
  })
  test('countdown', () => {
    const now = Date.parse('2026-10-10T00:00:00Z')
    expect(formatCountdown('2026-10-12T04:10:00Z', now)).toBe('2d 4h')
    expect(formatCountdown('2026-10-10T03:12:00Z', now)).toBe('3h 12m')
    expect(formatCountdown('2026-10-10T00:12:00Z', now)).toBe('12m')
    expect(formatCountdown('2026-10-09T00:00:00Z', now)).toBe('<1m')
  })
  test('no data shows no snacks yet', () => {
    const c = makeCaption('asleep', undefined, undefined, 0)
    expect(c.tail).toContain('no snacks yet')
    expect(compactLine(c)).toContain('no snacks yet')
  })
  test('normal caption has the bar, percent and reset time', () => {
    const reset = new Date(2026, 9, 15, 17, 0).toISOString()
    const c = makeCaption('huge', { percent: 68, resetsAt: reset }, { percent: 23 }, 0)
    expect(compactLine(c)).toBe('TONK ███████░░░ 68% · resets Thu 5pm')
    expect(c.five).toBe('5h ▰▱▱▱▱ 23%')
  })
  test('food coma shows the countdown', () => {
    const now = Date.parse('2026-10-10T00:00:00Z')
    const c = makeCaption('coma', { percent: 100, resetsAt: '2026-10-12T04:10:00Z' }, undefined, now)
    expect(c.tail).toContain('resets in 2d 4h')
  })
})

describe('pellet count mapping', () => {
  test('one pellet per 2k tokens, rounded up, capped at 12', () => {
    expect(pelletsForTokens(1)).toBe(1)
    expect(pelletsForTokens(2000)).toBe(1)
    expect(pelletsForTokens(2001)).toBe(2)
    expect(pelletsForTokens(10_000)).toBe(5)
    expect(pelletsForTokens(24_000)).toBe(12)
    expect(pelletsForTokens(9_000_000)).toBe(MAX_PELLETS)
    expect(pelletsForTokens(0)).toBe(0)
  })
  test('turn tokens count input, output and cache writes, not cache reads', () => {
    expect(turnTokens({ input_tokens: 100, output_tokens: 400, cache_creation_input_tokens: 1500, cache_read_input_tokens: 90_000 })).toBe(2000)
    expect(turnTokens(undefined)).toBe(0)
    expect(turnTokens({})).toBe(0)
  })
  test('source order: turn tokens, five-hour delta, weekly delta, snack', () => {
    const usage = { input_tokens: 3000, output_tokens: 3000 }
    expect(pelletsForTurn(usage, 4, 4)).toEqual({ n: 3, source: 'turn-usage' })
    expect(pelletsForTurn(undefined, 3, 9)).toEqual({ n: 6, source: 'five-hour-delta' })
    expect(pelletsForTurn(undefined, 0, 2)).toEqual({ n: 4, source: 'weekly-delta' })
    expect(pelletsForTurn(undefined, undefined, 1)).toEqual({ n: 2, source: 'weekly-delta' })
  })
  test('no data at all falls back to a one-pellet snack', () => {
    expect(pelletsForTurn(undefined, undefined, undefined)).toEqual({ n: 1, source: 'snack' })
    expect(pelletsForTurn(undefined, 0, 0)).toEqual({ n: 1, source: 'snack' })
    expect(pelletsForTurn({}, -3, -1)).toEqual({ n: 1, source: 'snack' })
    expect(pelletsForTurn(null, null, null)).toEqual({ n: 1, source: 'snack' })
  })
  test('delta fallbacks are capped', () => {
    expect(pelletsForTurn(undefined, 50, undefined).n).toBe(MAX_PELLETS)
    expect(pelletsForTurn(undefined, 0.1, undefined).n).toBe(1)
  })
})

describe('pellet motion', () => {
  test('a burst starts empty, ends done with every pellet eaten', () => {
    const burst = { start: 1000, n: 8 }
    const start = burstFrame(burst, 1000, MOUTH.round)
    expect(start.eaten).toBe(0)
    const mid = burstFrame(burst, 1000 + 700, MOUTH.round)
    expect(mid.pellets.length).toBeGreaterThan(0)
    const end = burstFrame(burst, 1000 + 3000, MOUTH.round)
    expect(end.eaten).toBe(8)
    expect(end.isDone).toBe(true)
    expect(end.pellets.length).toBe(0)
  })
  test('a burst lasts between 1 and 2.5 seconds', () => {
    for (const n of [1, 6, 12]) {
      const b = { start: 0, n }
      expect(burstFrame(b, 900, MOUTH.round).isDone || n > 1).toBe(true)
      expect(burstFrame(b, 2600, MOUTH.round).isDone).toBe(true)
    }
  })
  test('the stream keeps pellets in flight', () => {
    const f = streamFrame(300, { x: 10, y: 14 }, MOUTH.round)
    expect(f.pellets.length).toBe(3)
  })
})

describe('sprites', () => {
  const states = Object.keys(FRAME_COUNT) as Array<keyof typeof FRAME_COUNT>
  test('every frame is W x H and uses only palette chars', () => {
    for (const s of states)
      for (let i = 0; i < FRAME_COUNT[s]; i++) {
        const rows = buildFrame(s, i)
        expect(rows.length).toBe(H)
        for (const r of rows) {
          expect(r.length).toBe(W)
          for (const ch of r) expect(ch === '.' || ch in PALETTE).toBe(true)
        }
      }
  })
  test('frames within a state differ (an idle loop, not a still)', () => {
    for (const s of states) {
      const a = new Set(Array.from({ length: FRAME_COUNT[s] }, (_, i) => buildFrame(s, i).join('')))
      expect(a.size).toBeGreaterThan(1)
    }
  })
  test('raster cells pack two pixels per cell and encode 12 bytes a cell', () => {
    const { columns, rows, cells } = toRasterCells(buildFrame('round', 0))
    expect(columns).toBe(W)
    expect(rows).toBe(H / 2)
    const padded = cells.endsWith('==') ? 2 : cells.endsWith('=') ? 1 : 0
    expect((cells.length / 4) * 3 - padded).toBe(columns * rows * 12)
    const grid = toCellGrid(buildFrame('round', 0))
    expect(grid.every(r => r.every(c => c.ch === ' ' || c.ch === '▀' || c.ch === '▄'))).toBe(true)
  })
  test('the chomper is 30 x 6 pixels', () => {
    const rows = chompFrame(0)
    expect(rows.length).toBe(6)
    expect(rows[0]!.length).toBe(30)
  })
  test('the band shows the right mode: idle, working, burst, workout', () => {
    const base = { state: 'round' as const, now: 5000, isWorking: false }
    expect(bandFrame(base).mode).toBe('idle')
    expect(bandFrame({ ...base, isWorking: true }).mode).toBe('working')
    expect(bandFrame({ ...base, burst: { start: 4800, n: 5 } }).mode).toBe('burst')
    expect(bandFrame({ ...base, burst: { start: 0, n: 5 } }).mode).toBe('idle')
    expect(bandFrame({ ...base, state: 'workout' }).mode).toBe('workout')
    expect(bandFrame({ ...base, state: 'asleep', isWorking: true }).mode).toBe('idle')
  })
})

describe('pellet fallback order', () => {
  const u = { input_tokens: 500, output_tokens: 500, cache_creation_input_tokens: 1000, cache_read_input_tokens: 99999 }
  test('tokens beat both deltas; cache reads do not count', () => {
    expect(turnTokens(u)).toBe(2000)
    expect(pelletsForTurn(u, 9, 9)).toEqual({ n: 1, source: 'turn-usage' })
  })
  test('5-hour delta beats weekly delta', () => {
    expect(pelletsForTurn(undefined, 2, 8)).toEqual({ n: 4, source: 'five-hour-delta' })
  })
  test('zero-token usage falls through to the deltas, then the snack', () => {
    expect(pelletsForTurn({ input_tokens: 0 }, 0, 1)).toEqual({ n: 2, source: 'weekly-delta' })
    expect(pelletsForTurn({ input_tokens: 0 }, 0, 0)).toEqual({ n: 1, source: 'snack' })
  })
  test('delta pellets: 1 per half point, floor of 1, capped', () => {
    expect(pelletsForDelta(0.1)).toBe(1)
    expect(pelletsForDelta(3)).toBe(6)
    expect(pelletsForDelta(99)).toBe(MAX_PELLETS)
  })
})

describe('idle impatience', () => {
  test('tier thresholds: 2, 5 and 10 minutes', () => {
    expect(pokeTier(0)).toBeNull()
    expect(pokeTier(BORED_MS - 1)).toBeNull()
    expect(pokeTier(BORED_MS)).toBe('bored')
    expect(pokeTier(FRANTIC_MS - 1)).toBe('bored')
    expect(pokeTier(FRANTIC_MS)).toBe('frantic')
    expect(pokeTier(BANG_MS - 1)).toBe('frantic')
    expect(pokeTier(BANG_MS)).toBe('bang')
    expect(pokeTier(3 * 3600_000)).toBe('bang')
  })
  test('junk idle time is no tier', () => {
    expect(pokeTier(undefined)).toBeNull()
    expect(pokeTier(null)).toBeNull()
    expect(pokeTier(Number.NaN)).toBeNull()
    expect(pokeTier(-5)).toBeNull()
  })
  test('activity resets: idle 0 after a turn is no tier, and a running turn suppresses it', () => {
    expect(activeTier('round', 0)).toBeNull()
    expect(activeTier('round', BANG_MS, true)).toBeNull()
  })
  test('coma and asleep override every tier; the workout plays out', () => {
    for (const st of ['coma', 'asleep', 'workout'] as const) expect(activeTier(st, BANG_MS)).toBeNull()
    for (const st of ['skinny', 'snacking', 'round', 'huge', 'bloated'] as const) expect(activeTier(st, BANG_MS)).toBe('bang')
  })
  test('bandFrame never crashes on any tier, any state, with or without poke art', () => {
    for (const st of ['asleep', 'skinny', 'snacking', 'round', 'huge', 'bloated', 'coma', 'workout'] as const) {
      for (const idleMs of [0, BORED_MS, FRANTIC_MS, BANG_MS]) {
        const f = bandFrame({ state: st, now: 123456, isWorking: false, idleMs })
        expect(f.rows.length).toBe(H)
        expect(f.rows.every(r => r.length === W)).toBe(true)
      }
    }
  })
  test('a coma frame is identical at 0 and 10 minutes idle', () => {
    expect(bandFrame({ state: 'coma', now: 5000, isWorking: false, idleMs: BANG_MS }).rows)
      .toEqual(bandFrame({ state: 'coma', now: 5000, isWorking: false, idleMs: 0 }).rows)
  })
})
