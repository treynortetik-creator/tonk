// Frame selection: turns (state, time, activity) into the pixel rows to draw.
// Pure, so tests and the preview/terminal demo share it with the live mod.

import {
  activeTier, burstFrame, canIntro, canMicro, idleStep, introFrameIndex, introProgress, jiggleFrameIndex,
  jiggleProgress, microState, activeEvent, canEvent, EVENT_MS, IDLE_STEP_MS, streamFrame,
  type Burst, type EventId, type Micro, type PokeTier, type StateId,
} from './core.ts'
import * as sprites from './sprites.ts'
import {
  CAN_MOUTH, CHOMP_CAN, CHOMP_MOUTH, EAT_FRAME, H, MOUTH, SEQUENCE, W,
  buildChomp, buildFrame, type Mouth,
} from './sprites.ts'

export type Mode = 'event' | 'idle' | 'working' | 'burst' | 'workout' | 'poke' | 'intro' | 'jiggle'

export type Scene = {
  state: StateId
  now: number
  isWorking: boolean
  burst?: Burst | null
  /** ms since the last turn activity; drives the stick poke tiers. */
  idleMs?: number
  /** When the can-tip intro began (ms clock), or null/undefined when it is not playing. */
  introStart?: number | null
  /** Seed for the delight-event schedule (eventSeed(sessionId, startTime)); undefined disables events. */
  eventSeed?: number
  /** Local month 0-11; defaults to the month of `now`. */
  month?: number
}

/** Everything the round-3 art may export; every field is optional and every use is guarded. */
export type ArtApi = {
  POKE_FRAMES?: Partial<Record<PokeTier, number>>
  /** Number of tip-over intro frames (upright can ... spilled), played once. */
  INTRO_FRAMES?: number
  /** Number of belly-jiggle frames. */
  JIGGLE_FRAMES?: number
  /** True when the art can draw the drained can (coma) via `drained: true`. */
  DRAINED_CAN?: boolean
  buildFrame?: (state: StateId, frame: number, extras?: Record<string, unknown>) => string[]
  /** Event names, or a map of event name -> frame count. */
  EVENTS?: readonly string[] | Record<string, number | { frames?: number }>
  buildEventFrame?: (state: StateId, event: string, frame: number) => string[]
}

function eventTable(art: ArtApi): Map<string, number | undefined> {
  const m = new Map<string, number | undefined>()
  const ev = art.EVENTS
  if (!ev || !art.buildEventFrame) return m
  if (Array.isArray(ev)) for (const n of ev) m.set(String(n), undefined)
  else
    for (const [n, v] of Object.entries(ev as Record<string, unknown>)) {
      m.set(n, typeof v === 'number' ? v : typeof (v as { frames?: number })?.frames === 'number' ? (v as { frames: number }).frames : undefined)
    }
  return m
}

/** Draw one frame of a delight event; undefined on any problem so callers fall back to idle. */
function eventRows(art: ArtApi, state: StateId, id: EventId, progress: number, frames: number | undefined): string[] | undefined {
  try {
    const n = frames && frames > 0 ? frames : undefined
    const frame = n ? Math.min(n - 1, Math.floor(progress * n)) : Math.floor((progress * EVENT_MS[id]) / IDLE_STEP_MS)
    const rows = art.buildEventFrame?.(state, id, frame)
    return Array.isArray(rows) && rows.length === H && rows.every(r => typeof r === 'string' && r.length === W) ? rows : undefined
  } catch {
    return undefined
  }
}

const realArt = sprites as unknown as ArtApi

/** Draw a frame through the optional art API; undefined on any problem so callers fall back. */
function tryDraw(art: ArtApi, state: StateId, frame: number, extras: Record<string, unknown>): string[] | undefined {
  if (!art.buildFrame) return undefined
  try {
    const rows = art.buildFrame(state, frame, extras)
    return Array.isArray(rows) && rows.length === H && rows.every(r => typeof r === 'string' && r.length === W) ? rows : undefined
  } catch {
    return undefined
  }
}

/** The art agent's poke frames, if exported; undefined means fall back to the plain idle frame. */
function pokeRows(art: ArtApi, state: StateId, tier: PokeTier, now: number): string[] | undefined {
  const count = art.POKE_FRAMES?.[tier]
  if (!count) return undefined
  return tryDraw(art, state, idleStep(now) % count, { poke: tier })
}

/** Which micro layers the art actually has; unsupported ones are dropped. Exposed for tests. */
export function microExtras(m: Micro): Record<string, unknown> {
  const extras: Record<string, unknown> = {}
  if (m.blink) extras.blink = true
  if (m.tail) extras.tail = m.tail
  if (m.ear) extras.ear = true
  return extras
}

/** What the band shows: the weekly-state body, eating overlays while Claude works or a burst lands. */
export function bandFrame(scene: Scene, art: ArtApi = realArt): { rows: string[]; mode: Mode; event?: EventId } {
  const { state, now } = scene
  if (state === 'workout') {
    return { rows: buildFrame('workout', idleStep(now)), mode: 'workout' }
  }
  const seq = SEQUENCE[state]
  const idle = seq[idleStep(now) % seq.length]!
  const cannotEat = state === 'coma' || state === 'asleep'

  if (scene.burst) {
    const bf = burstFrame(scene.burst, now, MOUTH[state])
    if (!bf.isDone) {
      if (cannotEat) return { rows: buildFrame(state, idle, { pellets: bf.pellets }), mode: 'burst' }
      const mouth: Mouth = bf.isMouthOpen ? 'open' : bf.isChewing ? 'chew1' : 'chew0'
      return { rows: buildFrame(state, EAT_FRAME[state], { pellets: bf.pellets, mouth }), mode: 'burst' }
    }
    const jp = jiggleProgress(scene.burst, now)
    if (jp !== null && !cannotEat && art.JIGGLE_FRAMES) {
      const rows = tryDraw(art, state, idle, { jiggle: jiggleFrameIndex(jp, art.JIGGLE_FRAMES) })
      if (rows) return { rows, mode: 'jiggle' }
    }
  }
  if (scene.isWorking && !cannotEat) {
    const sf = streamFrame(now, CAN_MOUTH, MOUTH[state])
    const mouth: Mouth = sf.isMouthOpen ? 'open' : idleStep(now) % 2 ? 'chew1' : 'chew0'
    return { rows: buildFrame(state, EAT_FRAME[state], { pellets: sf.pellets, mouth }), mode: 'working' }
  }
  if (state === 'coma' && art.DRAINED_CAN) {
    const rows = tryDraw(art, state, idle, { drained: true })
    if (rows) return { rows, mode: 'idle' }
  }
  const ip = introProgress(scene.introStart, now)
  if (ip !== null && canIntro(state) && art.INTRO_FRAMES) {
    const rows = tryDraw(art, state, 0, { intro: introFrameIndex(ip, art.INTRO_FRAMES) })
    if (rows) return { rows, mode: 'intro' }
  }
  const tier = activeTier(state, scene.idleMs, scene.isWorking)
  if (tier) {
    const rows = pokeRows(art, state, tier, now)
    if (rows) return { rows, mode: 'poke' }
  }
  if (!tier && canEvent(state) && scene.eventSeed !== undefined && scene.idleMs !== undefined && Number.isFinite(scene.idleMs)) {
    const table = eventTable(art)
    if (table.size) {
      const month = scene.month ?? new Date(now).getMonth()
      const ev = activeEvent(scene.eventSeed, now - scene.idleMs, now, month, new Set(table.keys()))
      if (ev) {
        const rows = eventRows(art, state, ev.event, ev.progress, table.get(ev.event))
        if (rows) return { rows, mode: 'event', event: ev.event }
      }
    }
  }
  if (canMicro(state)) {
    const m = microState(now)
    const extras = microExtras(state === 'asleep' ? { ...m, blink: false } : m)
    // shimmer on every idle frame so the pellet pile twinkles continuously, not only during a blink/swish
    extras.shimmer = idleStep(now)
    const rows = tryDraw(art, state, idle, extras)
    if (rows) return { rows, mode: 'idle' }
  }
  return { rows: buildFrame(state, idle), mode: 'idle' }
}

/** The 30x6 Spinner chomper: a steady stream of pellets into a chewing mouth. */
export function chompFrame(now: number): string[] {
  const sf = streamFrame(now, CHOMP_CAN, CHOMP_MOUTH, 3, 2)
  return buildChomp(sf.isMouthOpen, sf.pellets)
}
