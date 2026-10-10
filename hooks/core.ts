// Pure logic for Tonk: no engine calls, so it tests and previews anywhere.

export type StateId =
  | 'asleep'
  | 'skinny'
  | 'snacking'
  | 'round'
  | 'huge'
  | 'bloated'
  | 'coma'
  | 'workout'

export type RateLimit = { kind: string; percentUsed: number; resetsAt?: string }
export type Window = { percent: number; resetsAt?: string }

export const WEEKLY_KIND = 'seven_day'
export const FIVE_HOUR_KIND = 'five_hour'

/** Weekly percent -> body state. Boundaries: 10, 35, 60, 80, 100 start the next state. */
export function pickState(percent: number | null | undefined): StateId {
  if (percent === null || percent === undefined || !Number.isFinite(percent)) return 'asleep'
  if (percent < 10) return 'skinny'
  if (percent < 35) return 'snacking'
  if (percent < 60) return 'round'
  if (percent < 80) return 'huge'
  if (percent < 100) return 'bloated'
  return 'coma'
}

export function findWindow(limits: readonly RateLimit[] | undefined, kind: string): Window | undefined {
  const hit = (limits ?? []).find(l => l.kind === kind && Number.isFinite(l.percentUsed))
  if (!hit) return undefined
  return { percent: Math.max(0, hit.percentUsed), resetsAt: hit.resetsAt }
}

export const RESET_DROP_POINTS = 20

/**
 * A reset is a sharp drop in the weekly percent versus the stored last value,
 * or the window rolling forward (resetsAt moves by more than a day) with the
 * percent lower than before.
 */
export function detectReset(
  prev: { percent: number; resetsAt?: string } | null | undefined,
  cur: { percent: number; resetsAt?: string } | null | undefined,
): boolean {
  if (!prev || !cur) return false
  if (prev.percent - cur.percent >= RESET_DROP_POINTS) return true
  if (prev.resetsAt && cur.resetsAt && prev.percent >= 10 && cur.percent < prev.percent) {
    const rolled = Date.parse(cur.resetsAt) - Date.parse(prev.resetsAt)
    if (Number.isFinite(rolled) && rolled > 24 * 3600 * 1000) return true
  }
  return false
}

export function bar(percent: number, width = 10): string {
  const p = Math.min(100, Math.max(0, percent))
  const filled = Math.round((p / 100) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

export function smallBar(percent: number, width = 5): string {
  const p = Math.min(100, Math.max(0, percent))
  const filled = Math.round((p / 100) * width)
  return '▰'.repeat(filled) + '▱'.repeat(width - filled)
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** `Thu 5pm`, `Thu 5:30pm`, in the machine's local time. */
export function formatReset(resetsAt: string | undefined): string | undefined {
  if (!resetsAt) return undefined
  const d = new Date(resetsAt)
  if (Number.isNaN(d.getTime())) return undefined
  const h = d.getHours()
  const m = d.getMinutes()
  const h12 = h % 12 === 0 ? 12 : h % 12
  const mm = m === 0 ? '' : `:${String(m).padStart(2, '0')}`
  return `${DAYS[d.getDay()]} ${h12}${mm}${h < 12 ? 'am' : 'pm'}`
}

/** `2d 4h`, `3h 12m`, `12m`, `<1m`. */
export function formatCountdown(resetsAt: string | undefined, now: number): string | undefined {
  if (!resetsAt) return undefined
  const ms = Date.parse(resetsAt) - now
  if (!Number.isFinite(ms)) return undefined
  if (ms <= 60_000) return '<1m'
  const mins = Math.floor(ms / 60_000)
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export const QUIPS: Record<StateId, string> = {
  asleep: 'no snacks yet',
  skinny: 'feed me tokens',
  snacking: 'nom nom',
  round: 'good munch',
  huge: "belt's holding. barely.",
  bloated: '...hurp',
  coma: 'do not disturb',
  workout: 'fresh week. fresh hunger.',
}

export type Caption = { title: string; bar: string; pct: string; tail: string; sub: string; five: string }

export function makeCaption(
  state: StateId,
  weekly: Window | undefined,
  five: Window | undefined,
  now: number,
): Caption {
  const fiveText = five ? `5h ${smallBar(five.percent)} ${Math.round(five.percent)}%` : ''
  if (state === 'asleep' || !weekly) {
    return { title: 'TONK', bar: '', pct: '', tail: 'zzz  no snacks yet', sub: 'waiting on a usage reading', five: fiveText }
  }
  const pct = `${Math.round(weekly.percent)}%`
  const at = formatReset(weekly.resetsAt)
  if (state === 'coma') {
    const left = formatCountdown(weekly.resetsAt, now)
    const tail = left ? `food coma · resets in ${left}${at ? ` (${at})` : ''}` : 'food coma'
    return { title: 'TONK', bar: bar(weekly.percent), pct, tail, sub: QUIPS.coma, five: fiveText }
  }
  if (state === 'workout') {
    return { title: 'TONK', bar: bar(weekly.percent), pct, tail: 'RESET! workout time', sub: QUIPS.workout, five: fiveText }
  }
  return {
    title: 'TONK',
    bar: bar(weekly.percent),
    pct,
    tail: at ? `resets ${at}` : '',
    sub: QUIPS[state],
    five: fiveText,
  }
}

/** One-line plain text for narrow terminals and the desktop surface. */
export function compactLine(c: Caption): string {
  return [c.title, c.bar, c.pct, c.tail ? `· ${c.tail}` : ''].filter(Boolean).join(' ')
}

// ---- pellets per turn -------------------------------------------------

export const TOKENS_PER_PELLET = 2000
export const MAX_PELLETS = 12
/** Percent points per pellet when only a window's delta is known. */
export const POINTS_PER_PELLET = 0.5

export type PelletSource = 'turn-usage' | 'five-hour-delta' | 'weekly-delta' | 'snack'
export type TurnUsageLike = {
  input_tokens?: number
  output_tokens?: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

/** Tokens that cost the person something: input + output + cache writes (cache reads are near-free, left out). */
export function turnTokens(u: TurnUsageLike | undefined | null): number {
  if (!u) return 0
  const n = (u.input_tokens ?? 0) + (u.output_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function pelletsForTokens(tokens: number): number {
  if (!(tokens > 0)) return 0
  return Math.min(MAX_PELLETS, Math.max(1, Math.ceil(tokens / TOKENS_PER_PELLET)))
}

/** Pellets from a percent delta: one per POINTS_PER_PELLET points, at least 1, capped. */
export function pelletsForDelta(delta: number): number {
  return Math.min(MAX_PELLETS, Math.max(1, Math.round(delta / POINTS_PER_PELLET)))
}

/**
 * How many pellets a finished turn drops, and which data said so. Order:
 * per-turn token usage, then the 5-hour percent delta, then the weekly percent
 * delta, then a 1-pellet snack.
 */
export function pelletsForTurn(
  usage: TurnUsageLike | undefined | null,
  fiveHourDelta: number | undefined | null,
  weeklyDelta?: number | undefined | null,
): { n: number; source: PelletSource } {
  const tokens = turnTokens(usage)
  if (tokens > 0) return { n: pelletsForTokens(tokens), source: 'turn-usage' }
  if (fiveHourDelta !== undefined && fiveHourDelta !== null && fiveHourDelta > 0)
    return { n: pelletsForDelta(fiveHourDelta), source: 'five-hour-delta' }
  if (weeklyDelta !== undefined && weeklyDelta !== null && weeklyDelta > 0)
    return { n: pelletsForDelta(weeklyDelta), source: 'weekly-delta' }
  return { n: 1, source: 'snack' }
}

// ---- pellet motion ----------------------------------------------------

export type Burst = { start: number; n: number }
export type Pellet = { x: number; y: number }

export const FALL_MS = 520
export const CHEW_MS = 260

export function burstWindowMs(n: number): number {
  return Math.min(1800, 1000 + n * 70)
}

/** Deterministic x for pellet i, spread over [lo, hi]. */
export function dropX(i: number, lo: number, hi: number): number {
  const h = (i * 2654435761) >>> 0
  return lo + (h % (hi - lo + 1))
}

export type BurstFrame = {
  pellets: Pellet[]
  eaten: number
  isDone: boolean
  isMouthOpen: boolean
  isChewing: boolean
}

/** Where every pellet of a burst is `now`; they fall from above toward `mouth` and vanish when eaten. */
export function burstFrame(burst: Burst, now: number, mouth: Pellet, lo = 14, hi = 38): BurstFrame {
  const t = now - burst.start
  const spacing = burstWindowMs(burst.n) / burst.n
  const pellets: Pellet[] = []
  let eaten = 0
  let lastEaten = -Infinity
  let isMouthOpen = false
  for (let i = 0; i < burst.n; i++) {
    const t0 = i * spacing
    const u = (t - t0) / FALL_MS
    if (u < 0) continue
    if (u >= 1) {
      eaten++
      lastEaten = Math.max(lastEaten, t0 + FALL_MS)
      continue
    }
    const e = u * u
    const x0 = dropX(i, lo, hi)
    const x = Math.round(x0 + (mouth.x - 1 - x0) * e)
    const y = Math.round(-3 + (mouth.y - 1 + 3) * e)
    pellets.push({ x, y })
    if (u > 0.55) isMouthOpen = true
  }
  const isChewing = !isMouthOpen && t - lastEaten < CHEW_MS
  const endMs = (burst.n - 1) * spacing + FALL_MS + CHEW_MS
  return { pellets, eaten, isDone: t >= endMs, isMouthOpen, isChewing }
}

export const STREAM_PERIOD_MS = 900

/** A steady stream of pellets arcing from `from` (the can's mouth) into `mouth`, for live eating. */
export function streamFrame(now: number, from: Pellet, mouth: Pellet, count = 3, size = 3): { pellets: Pellet[]; isMouthOpen: boolean } {
  const pellets: Pellet[] = []
  let isMouthOpen = false
  for (let i = 0; i < count; i++) {
    const u = (((now / STREAM_PERIOD_MS + i / count) % 1) + 1) % 1
    const x = Math.round(from.x + (mouth.x - size / 2 - from.x) * u)
    const lift = (from.y - mouth.y + 6) * 4 * u * (1 - u)
    const y = Math.round(from.y + (mouth.y - size / 2 - from.y) * u - lift)
    pellets.push({ x, y })
    if (u > 0.8) isMouthOpen = true
  }
  return { pellets, isMouthOpen }
}

/** Frame clock: 8 fps while animating, idle loops advance every 250 ms. */
export const TICK_MS = 125
export const IDLE_STEP_MS = 250
export function idleStep(now: number): number {
  return Math.floor(now / IDLE_STEP_MS)
}

// ---- idle impatience --------------------------------------------------

export type PokeTier = 'bored' | 'frantic' | 'bang'
export const BORED_MS = 2 * 60_000
export const FRANTIC_MS = 5 * 60_000
export const BANG_MS = 10 * 60_000

/** How impatient Tonk is after `idleMs` with no turn activity; null under 2 minutes. */
export function pokeTier(idleMs: number | null | undefined): PokeTier | null {
  if (idleMs === null || idleMs === undefined || !Number.isFinite(idleMs)) return null
  if (idleMs >= BANG_MS) return 'bang'
  if (idleMs >= FRANTIC_MS) return 'frantic'
  if (idleMs >= BORED_MS) return 'bored'
  return null
}

/** Asleep and coma stay asleep, the workout plays out; everyone else gets impatient. */
export function canPoke(state: StateId): boolean {
  return state !== 'asleep' && state !== 'coma' && state !== 'workout'
}

/** The tier to draw now: none while a turn runs, none for sleepers, else by idle time. */
export function activeTier(state: StateId, idleMs: number | null | undefined, isWorking = false): PokeTier | null {
  if (isWorking || !canPoke(state)) return null
  return pokeTier(idleMs)
}

export const POKE_QUIPS: Record<PokeTier, string> = {
  bored: '...hello? the can is empty',
  frantic: 'FEED. ME. TOKENS.',
  bang: '*BANG BANG BANG* open up!',
}

// ---- can intro (round 3) ----------------------------------------------

/** The tip-over intro: upright can, Tonk knocks it over, pellets spill. Plays once per session and after a reset workout. */
export const INTRO_MS = 2600

export const INTRO_QUIP = 'oops. dinner is served.'

/** Coma sleeps through it and the workout is its own show; everyone else (asleep included) gets the tip. */
export function canIntro(state: StateId): boolean {
  return state !== 'coma' && state !== 'workout'
}

/** Progress 0..1 through the intro, or null when it is not playing (not started, or over). */
export function introProgress(startedAt: number | null | undefined, now: number): number | null {
  if (startedAt === null || startedAt === undefined || !Number.isFinite(startedAt)) return null
  const t = now - startedAt
  if (t < 0 || t >= INTRO_MS) return null
  return t / INTRO_MS
}

/** Which of `count` intro frames to show at `progress`; the last frame holds (the spilled can). */
export function introFrameIndex(progress: number, count: number): number {
  if (count <= 1) return 0
  return Math.min(count - 1, Math.max(0, Math.floor(progress * count)))
}

// ---- belly jiggle ------------------------------------------------------

export const JIGGLE_MS = 500

/** When the burst's last pellet has been swallowed (the moment it "lands"). */
export function burstEndMs(burst: Burst): number {
  const spacing = burstWindowMs(burst.n) / burst.n
  return burst.start + (burst.n - 1) * spacing + FALL_MS + CHEW_MS
}

/** Jiggle progress 0..1 for JIGGLE_MS after the burst lands, else null. */
export function jiggleProgress(burst: Burst | null | undefined, now: number): number | null {
  if (!burst) return null
  const t = now - burstEndMs(burst)
  if (t < 0 || t >= JIGGLE_MS) return null
  return t / JIGGLE_MS
}

/** Which of `count` jiggle frames to show; null progress means no jiggle. */
export function jiggleFrameIndex(progress: number, count: number): number {
  return introFrameIndex(progress, count)
}

// ---- idle micro-animations ---------------------------------------------

function hash32(n: number): number {
  let h = (n ^ 0x9e3779b9) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}

type Channel = { slotMs: number; jitterMs: number; durMs: number; seed: number }
/** Blink every 3-6 s (4500 ms slot + 0..1500 jitter), tail swish about every 11-14 s, ear twitch every 17-21 s. */
export const MICRO: Record<'blink' | 'tail' | 'ear', Channel> = {
  blink: { slotMs: 4500, jitterMs: 1500, durMs: 250, seed: 11 },
  tail: { slotMs: 11000, jitterMs: 3000, durMs: 750, seed: 23 },
  ear: { slotMs: 17000, jitterMs: 4000, durMs: 250, seed: 37 },
}

/** Start time of the event in slot `i` for a channel. */
export function microStart(kind: keyof typeof MICRO, slot: number): number {
  const c = MICRO[kind]
  return slot * c.slotMs + (hash32(slot * 131 + c.seed) % (c.jitterMs + 1))
}

/** Progress 0..1 through the channel's event at `now`, or null between events. Pure and seeded by time only. */
export function microProgress(kind: keyof typeof MICRO, now: number): number | null {
  const c = MICRO[kind]
  const slot = Math.floor(now / c.slotMs)
  const t = now - microStart(kind, slot)
  if (t < 0 || t >= c.durMs) return null
  return t / c.durMs
}

export type Micro = { blink: boolean; tail: 0 | 1 | 2; ear: boolean }

/** Blink, tail and ear state at `now`. Tail alternates poses 1 and 2 every 250 ms while swishing. */
export function microState(now: number): Micro {
  const tp = microProgress('tail', now)
  const tail = tp === null ? 0 : ((Math.floor((tp * MICRO.tail.durMs) / 250) % 2) + 1) as 1 | 2
  return { blink: microProgress('blink', now) !== null, tail, ear: microProgress('ear', now) !== null }
}

/** Micro-animations play on any resting body except coma and the workout (asleep gets tail and ear only). */
export function canMicro(state: StateId): boolean {
  return state !== 'coma' && state !== 'workout'
}

// ---- random delight events (round 3) -----------------------------------

export type EventId =
  | 'wash' | 'treasure' | 'lid_hat' | 'juggle' | 'sneeze' | 'look_up' | 'golden' | 'doze' | 'bandana_cape'

/** Relative weights: the four commons fire often, golden is ~1 in 50, the rest sit in between. */
export const EVENT_WEIGHTS: Record<EventId, number> = {
  look_up: 12, wash: 12, sneeze: 12, doze: 12,
  treasure: 6, lid_hat: 6, juggle: 6, bandana_cape: 6,
  golden: 1.2,
}
export const EVENT_IDS = Object.keys(EVENT_WEIGHTS) as EventId[]
/** How long each event plays, ms. */
export const EVENT_MS: Record<EventId, number> = {
  wash: 3000, treasure: 2500, lid_hat: 3000, juggle: 3000, sneeze: 1500,
  look_up: 2000, golden: 2500, doze: 4000, bandana_cape: 3000,
}
export const EVENT_MIN_GAP_MS = 45_000
export const EVENT_MAX_GAP_MS = 120_000
export const OCTOBER = 9
export const GOLDEN_QUIP = '✨ golden snack!'

export function eventOk(id: EventId, month: number): boolean {
  return id !== 'bandana_cape' || month === OCTOBER
}

/** Weighted pick from `r` in [0,1); never `prev`; bandana_cape only in October; only ids in `available` when given. */
export function pickEvent(r: number, prev: EventId | null, month: number, available?: ReadonlySet<string>): EventId | null {
  const pool = EVENT_IDS.filter(id => id !== prev && eventOk(id, month) && (!available || available.has(id)))
  const total = pool.reduce((a, id) => a + EVENT_WEIGHTS[id], 0)
  if (!pool.length || !(total > 0)) return null
  let x = Math.min(0.999999999, Math.max(0, r)) * total
  for (const id of pool) {
    x -= EVENT_WEIGHTS[id]
    if (x < 0) return id
  }
  return pool[pool.length - 1]!
}

/** Seed from a session id string (or anything) mixed with a time. */
export function eventSeed(sessionId: string | undefined, time: number): number {
  let h = hash32(Math.floor(time / 1000))
  for (const ch of sessionId ?? '') h = hash32(h ^ ch.charCodeAt(0))
  return h
}

const unit = (n: number) => hash32(n) / 4294967296

/** The i-th event after `anchor`: when it starts and which one (never the same as the one before). */
export function eventSchedule(seed: number, anchor: number, count: number, month: number, available?: ReadonlySet<string>) {
  const out: Array<{ start: number; event: EventId }> = []
  let t = anchor
  let prev: EventId | null = null
  for (let i = 0; i < count; i++) {
    const gap = EVENT_MIN_GAP_MS + unit(seed * 31 + anchor + i * 7919) * (EVENT_MAX_GAP_MS - EVENT_MIN_GAP_MS)
    const event = pickEvent(unit(seed * 17 + anchor + i * 104729 + 1), prev, month, available)
    t += gap
    if (!event) break
    out.push({ start: Math.round(t), event })
    t += EVENT_MS[event]
    prev = event
  }
  return out
}

/** Events only on an awake, resting body; the caller also gates on turn, intro, burst and pokes. */
export function canEvent(state: StateId): boolean {
  return state !== 'asleep' && state !== 'coma' && state !== 'workout'
}

export type ActiveEvent = { event: EventId; progress: number; index: number }

/** The event playing at `now` for idle time measured from `anchor`, or null. Deterministic in (seed, anchor, now). */
export function activeEvent(seed: number, anchor: number, now: number, month: number, available?: ReadonlySet<string>): ActiveEvent | null {
  if (now < anchor) return null
  const sched = eventSchedule(seed, anchor, 6, month, available)
  for (let i = 0; i < sched.length; i++) {
    const s = sched[i]!
    const t = now - s.start
    if (t >= 0 && t < EVENT_MS[s.event]) return { event: s.event, progress: t / EVENT_MS[s.event], index: i }
  }
  return null
}
