// Tonk's pixel art: the export index. The kit (palette, head, bodies, props)
// lives in sprites/base.ts; the can intro in sprites/intro.ts; the random
// delight events in sprites/events.ts. This file composes frames and encodes
// them for the terminal Raster.

import type { Pellet, PokeTier, StateId } from './core.ts'
import {
  Grid, H, HEAD_POS, HEAD_X, JIGGLE_FRAMES, PALETTE as PALETTE_REF, PILE, SHOULDER_L, UPRIGHT_CAN, UPRIGHT_X, UPRIGHT_Y, W,
  arm, burpPuff, can, drawBody, drip, head, incoming, jiggleTicks, pellet, pile, rainOnPile, sweat, zed,
  type Brow, type Eyes, type Mouth,
} from './sprites/base.ts'
import { INTRO_FRAMES, drawIntro } from './sprites/intro.ts'
import { EVENTS, drawEvent, type EventName } from './sprites/events.ts'

export { CAN, CAN_DRAINED, HEAD_POS, HEAD_W, HEAD_X, JIGGLE_FRAMES, MOUTH, PALETTE, PILE, UPRIGHT_CAN, H, W } from './sprites/base.ts'
export type { Brow, Eyes, Mouth } from './sprites/base.ts'
export { INTRO_FRAMES } from './sprites/intro.ts'
export { EVENTS, EVENT_NAMES } from './sprites/events.ts'
export type { EventName } from './sprites/events.ts'
export type { PokeTier }

export const CHOMP_W = 30
export const CHOMP_H = 6

/** render.ts checks this before passing `drained: true`. */
export const DRAINED_CAN = true

export type Extras = {
  pellets?: Pellet[]
  mouth?: Mouth
  pileOverride?: number
  poke?: PokeTier
  /** Tip-over intro frame, 0..INTRO_FRAMES-1. */
  intro?: number
  /** Belly jiggle frame, 0..JIGGLE_FRAMES-1. */
  jiggle?: number
  /** The licked-clean can (coma and asleep default to it). */
  drained?: boolean
  blink?: boolean
  tail?: 0 | 1 | 2
  ear?: boolean
  /** Pile glint phase (pass idleStep(now)); absent = the frame index. */
  shimmer?: number
}

/** Top-left of a pellet leaving the can's glowing mouth (streams start here). */
export const CAN_MOUTH: Pellet = { x: 9, y: 13 }
/** Frames that hold nothing in the paws: the ones eating overlays sit on. */
export const EAT_FRAME: Record<StateId, number> = { asleep: 0, skinny: 0, snacking: 2, round: 2, huge: 6, bloated: 0, coma: 0, workout: 0 }
export const FRAME_COUNT: Record<StateId, number> = { asleep: 2, skinny: 3, snacking: 4, round: 3, huge: 8, bloated: 4, coma: 4, workout: 2 }
export const SEQUENCE: Record<StateId, number[]> = {
  asleep: [0, 0, 1, 1],
  skinny: [0, 0, 0, 0, 2, 2, 0, 0, 1, 1, 0, 0],
  snacking: [0, 0, 1, 2, 3, 2, 3],
  round: [0, 1, 2, 2, 1],
  huge: [0, 1, 2, 3, 4, 5, 6, 7],
  bloated: [0, 1, 0, 1, 2, 3, 3],
  coma: [0, 1, 2, 3],
  workout: [0, 1],
}

// ---- idle impatience: stick pokes and can banging ----------------------

/** Idle-impatience loops in 250 ms idle steps; bored holds each pose 4 steps so the poke stays lazy. */
export const POKE_SEQUENCE: Record<PokeTier, number[]> = {
  bored: [0, 0, 0, 0, 1, 1, 1, 1],
  frantic: [0, 1, 2],
  bang: [0, 1, 2],
}
export const POKE_FRAMES: Record<PokeTier, number> = {
  bored: POKE_SEQUENCE.bored.length,
  frantic: POKE_SEQUENCE.frantic.length,
  bang: POKE_SEQUENCE.bang.length,
}

type PokePose = { paw: Pellet; tip: Pellet; can?: [number, number]; bang?: 0 | 1 | 2; motion?: boolean }
const POKE_POSES: Record<PokeTier, PokePose[]> = {
  bored: [
    { paw: { x: 18, y: 14 }, tip: { x: 10, y: 14 } },
    { paw: { x: 18, y: 15 }, tip: { x: 11, y: 17 } },
  ],
  frantic: [
    { paw: { x: 17, y: 13 }, tip: { x: 8, y: 14 }, motion: true, can: [-1, 0] },
    { paw: { x: 19, y: 12 }, tip: { x: 12, y: 10 } },
    { paw: { x: 17, y: 14 }, tip: { x: 9, y: 16 }, motion: true },
  ],
  bang: [
    { paw: { x: 17, y: 5 }, tip: { x: 11, y: 0 } },
    { paw: { x: 16, y: 10 }, tip: { x: 4, y: 9 }, can: [0, 1], bang: 1 },
    { paw: { x: 17, y: 6 }, tip: { x: 9, y: 2 }, can: [-1, 0], bang: 2 },
  ],
}
const POKE_FACE: Record<PokeTier, { eyes: Eyes; mouth: Mouth; brow?: Brow }> = {
  bored: { eyes: 'lidded', mouth: 'flat', brow: 'bored' },
  frantic: { eyes: 'annoyed', mouth: 'grit', brow: 'annoyed' },
  bang: { eyes: 'annoyed', mouth: 'open', brow: 'annoyed' },
}

function bangPop(g: Grid, level: 1 | 2) {
  const x = level === 1 ? 3 : 2
  const y = level === 1 ? 2 : 1
  g.rect(x, y, x + level - 1, y + 2, 'Y')
  g.rect(x, y + 4, x + level - 1, y + 4, 'Y')
}

function pokePaw(state: StateId, pose: PokePose) {
  const sh = SHOULDER_L[state]
  const paw = { x: Math.min(pose.paw.x, sh.x - 3), y: pose.paw.y }
  // keep the stick at least 6 px long when a fat body pushes the paw left
  const tip = { x: Math.min(pose.tip.x, paw.x - 6), y: pose.tip.y }
  return { sh, paw, tip }
}

function pokeArm(g: Grid, state: StateId, pose: PokePose) {
  const { sh, paw, tip } = pokePaw(state, pose)
  g.line(paw.x + 1, paw.y, tip.x, tip.y, 1, 'n')
  g.line(Math.round((paw.x * 2 + tip.x) / 3), Math.round((paw.y * 2 + tip.y) / 3), Math.round((paw.x + tip.x * 2) / 3), Math.round((paw.y + tip.y * 2) / 3), 1, 'b')
  arm(g, state, sh, { x: paw.x, y: paw.y - 1 })
  g.rect(paw.x, paw.y - 1, paw.x + 1, paw.y, 'd')
}

function pokePose(tier: PokeTier, frame: number): PokePose {
  const seq = POKE_SEQUENCE[tier]
  return POKE_POSES[tier][seq[((frame % seq.length) + seq.length) % seq.length]!]!
}

function pokeFrame(g: Grid, state: StateId, tier: PokeTier, pose: PokePose, ex: Extras) {
  const face = POKE_FACE[tier]
  const [cdx, cdy] = pose.can ?? [0, 0]
  can(g, { dx: cdx, dy: cdy, lid: true })
  const eyes: Eyes = ex.blink ? 'closed' : face.eyes
  const o = { arms: 'right' as const, tail: ex.tail ?? (tier === 'bored' ? 0 : 2), ear: ex.ear, eyes, mouth: face.mouth, brow: ex.blink ? undefined : face.brow }
  drawBody(g, state, o)
  pokeArm(g, state, pose)
  // the face goes on last so the stick arm never covers it
  const hp = HEAD_POS[state]
  head(g, hp.x, hp.y, eyes, face.mouth, { brow: o.brow, ear: ex.ear })
}

// ---- frames ------------------------------------------------------------

function idleBody(g: Grid, state: StateId, f: number, ex: Extras) {
  const micro = { blink: ex.blink, ear: ex.ear, tail: ex.tail, jiggle: ex.jiggle }
  switch (state) {
    case 'asleep':
      drawBody(g, 'asleep', { ...micro, blink: false, mouth: f ? 'chew1' : 'flat' })
      break
    case 'skinny':
      drawBody(g, 'skinny', { ...micro, pose: f, headDx: f === 2 ? -1 : 0, tail: ex.tail ?? (f === 1 ? 2 : 0) })
      break
    case 'workout':
      drawBody(g, 'workout', { pose: f })
      break
    default:
      drawBody(g, state, { ...micro, pose: f })
  }
}

/** Eating: both paws up at the mouth, the eating mouth, the state's own eyes. */
function eatBody(g: Grid, state: StateId, f: number, mouth: Mouth, ex: Extras) {
  const eyes: Eyes = state === 'huge' || state === 'bloated' ? 'lidded' : state === 'skinny' ? 'wide' : 'happy'
  drawBody(g, state, {
    pose: f, arms: 'hold', mouth, eyes, brow: state === 'skinny' ? 'hungry' : undefined,
    blink: ex.blink, ear: ex.ear, tail: ex.tail, jiggle: ex.jiggle,
  })
}

/** Build one frame of a state as rows of palette chars (W x H). */
export function buildFrame(state: StateId, frame: number, extras: Extras = {}): string[] {
  const g = new Grid(W, H)
  const drained = extras.drained ?? (state === 'coma' || state === 'asleep')
  if (extras.intro !== undefined && Number.isFinite(extras.intro)) {
    const { post } = drawIntro(g, state, extras.intro, drained)
    g.outline()
    post(g)
    return g.rows()
  }
  const tier = extras.poke
  if (tier && state !== 'asleep' && state !== 'coma' && state !== 'workout') {
    const pose = pokePose(tier, frame)
    pokeFrame(g, state, tier, pose, extras)
    g.outline()
    if (pose.motion) {
      const { paw } = pokePaw(state, pose)
      for (const [x, y] of [[-3, -2], [-4, -2], [-5, -2], [-3, 2], [-4, 2]] as Array<[number, number]>) g.set(paw.x + x, paw.y + y, 'c')
    }
    if (pose.bang) bangPop(g, pose.bang)
    if (pose.bang === 2) pellet(g, 12, 8, 'w')
    if (pose.bang === 1) for (const [x, y] of [[0, 7], [1, 6], [9, 7], [10, 6]] as Array<[number, number]>) g.set(x, y, 'c')
    return g.rows()
  }
  const f = ((Math.floor(frame) % FRAME_COUNT[state]) + FRAME_COUNT[state]) % FRAME_COUNT[state]
  can(g, { drained })
  // the pile sits behind Tonk so his silhouette stays clean
  pile(g, extras.pileOverride ?? PILE[state], extras.shimmer ?? f)
  const eatMouth = extras.mouth
  const eating = !!eatMouth && state !== 'asleep' && state !== 'coma' && state !== 'workout'
  if (eating) eatBody(g, state, f, eatMouth, extras)
  else idleBody(g, state, f, extras)
  g.outline()
  if (state === 'bloated' && (f === 2 || f === 3) && !eating) burpPuff(g, f)
  if (state === 'bloated') sweat(g, HEAD_X - 2, 4 + (f % 2)), sweat(g, HEAD_X + 18, 6 - (f % 2))
  if (state === 'huge') drip(g, f)
  if (state === 'workout') sweat(g, HEAD_X + 18, f === 1 ? 2 : 4)
  if (state === 'asleep') {
    if (f === 0) zed(g, 38, 3, false)
    else zed(g, 38, 2, false), zed(g, 40, 0, false)
  }
  if (state === 'coma') {
    const Z: Array<[number, number, boolean]> = [[38, 3, false], [40, 0, true], [35, 0, false]]
    Z.slice(0, f === 3 ? 3 : f + 1).forEach(([x, y, big]) => zed(g, x, y, big))
  }
  if (extras.jiggle !== undefined) jiggleTicks(g, state, extras.jiggle)
  const pellets = extras.pellets ?? []
  if (pellets.length) {
    if (state === 'asleep' || state === 'coma') rainOnPile(g, pellets)
    else incoming(g, state, CAN_MOUTH, pellets)
  }
  return g.rows()
}

/** The can on an empty floor (W x H): 'upright' (lid on), 'tipped' (lid resting on it) or 'drained'. */
export function buildCanFrame(look: 'upright' | 'tipped' | 'drained'): string[] {
  const g = new Grid(W, H)
  if (look === 'upright') g.stamp(UPRIGHT_X, UPRIGHT_Y, UPRIGHT_CAN)
  else can(g, { drained: look === 'drained' })
  g.outline()
  return g.rows()
}

/** One frame of a delight event (W x H). Bodies without their own art reuse the round choreography at their size. */
export function buildEventFrame(state: StateId, event: EventName, frame: number): string[] {
  const g = new Grid(W, H)
  const spec = EVENTS[event]
  if (!spec || state === 'asleep' || state === 'coma' || state === 'workout') return buildFrame(state, 0)
  const k = ((Math.floor(frame) % spec.frames) + spec.frames) % spec.frames
  const post = drawEvent(g, state, event, k)
  g.outline()
  post(g)
  return g.rows()
}

// ---- the Spinner chomper (30 x 6) -------------------------------------
// Head only, front view, 13 wide: ears, white brows, the dark mask band with
// two glinting eyes, a light muzzle with the black nose, and a mouth that
// snaps open (red-brown inside) as each pellet arrives. Pellets hop out of a
// can stub and slide in level with the mouth, never across the eyes.

const CHOMP_SHUT = [
  '.gd.......dg.',
  'ggwwgggggwwgg',
  'mmWkmmhmmWkmm',
  'hmmmwNNNwmmmh',
  '.hhwkwwwkwhh.',
  '..hhwkkkwhh..',
]
const CHOMP_OPEN = [
  '.gd.......dg.',
  'ggwwgggggwwgg',
  'mmWkmmhmmWkmm',
  'hmmmwNNNwmmmh',
  '.hhwkjjjkwhh.',
  '..hhkjjjkhh..',
]
const CHOMP_HX = 15
export const CHOMP_MOUTH: Pellet = { x: CHOMP_HX + 7, y: 5 }
export const CHOMP_CAN: Pellet = { x: 4, y: 1 }

export function buildChomp(open: boolean, pellets: Pellet[]): string[] {
  const g = new Grid(CHOMP_W, CHOMP_H)
  // a can stub at the far left: the pellets' source
  g.stamp(0, 0, ['ttq.', 'tTqO', 'tTqy', 'tTqO', 'tTqO', 'TTq.'])
  // ringed tail flicking up behind the head
  g.stamp(CHOMP_HX + 13, 1, ['.m', 'gg', 'mm', 'g.'])
  g.stamp(CHOMP_HX, 0, open ? CHOMP_OPEN : CHOMP_SHUT)
  g.outline()
  const x0 = CHOMP_CAN.x
  const x1 = CHOMP_MOUTH.x - 1
  const level = CHOMP_HX - 3
  for (const p of pellets) {
    // progress from x (the stream is linear in x), redrawn on our own path
    const u = Math.max(0, Math.min(1, (p.x - x0) / (x1 - x0)))
    const x = Math.round(x0 + (x1 - x0) * u)
    const s = Math.min(1, (x - x0) / (level - x0))
    const y = x >= level ? CHOMP_MOUTH.y - 1 : Math.round(2 + (CHOMP_MOUTH.y - 3) * s - 2 * Math.sin(Math.PI * s))
    g.set(x, y, 'y')
    g.set(x + 1, y, 'o')
    g.set(x, y + 1, 'o')
    g.set(x + 1, y + 1, 'O')
  }
  return g.rows()
}

// ---- encoding --------------------------------------------------------

const DEFAULT = 0x01000000
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function base64(bytes: number[]): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!
    const b = bytes[i + 1]
    const c = bytes[i + 2]
    out += B64[a >> 2]! + B64[((a & 3) << 4) | ((b ?? 0) >> 4)]!
    out += b === undefined ? '=' : B64[((b & 15) << 2) | ((c ?? 0) >> 6)]!
    out += c === undefined ? '=' : B64[c & 63]!
  }
  return out
}

export type Cell = { ch: string; fg: number; bg: number }

/** Pack two pixel rows into one terminal row of half blocks. */
export function toCellGrid(frame: string[]): Cell[][] {
  const PAL = PALETTE_REF
  const rows: Cell[][] = []
  for (let y = 0; y < frame.length; y += 2) {
    const row: Cell[] = []
    for (let x = 0; x < frame[0]!.length; x++) {
      const t = frame[y]![x]!
      const b = frame[y + 1]?.[x] ?? '.'
      const tc = t === '.' ? undefined : PAL[t]
      const bc = b === '.' ? undefined : PAL[b]
      if (tc === undefined && bc === undefined) row.push({ ch: ' ', fg: DEFAULT, bg: DEFAULT })
      else if (bc === undefined) row.push({ ch: '▀', fg: tc!, bg: DEFAULT })
      else if (tc === undefined) row.push({ ch: '▄', fg: bc, bg: DEFAULT })
      else row.push({ ch: '▀', fg: tc, bg: bc })
    }
    rows.push(row)
  }
  return rows
}

/** `RasterProps.cells`: base64 of little-endian u32 [codePoint, fg, bg] triplets, row-major. */
export function toRasterCells(frame: string[]): { columns: number; rows: number; cells: string } {
  const grid = toCellGrid(frame)
  const bytes: number[] = []
  for (const row of grid)
    for (const c of row)
      for (const v of [c.ch.codePointAt(0)!, c.fg, c.bg]) bytes.push(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255)
  return { columns: grid[0]!.length, rows: grid.length, cells: base64(bytes) }
}

void JIGGLE_FRAMES
