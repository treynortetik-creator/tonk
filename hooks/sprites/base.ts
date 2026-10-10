// Tonk's pixel-art kit: palette, the Grid canvas, the head, tails, props, and
// every body. Frames are palette-indexed character grids (one char per pixel,
// '.' clear). sprites.ts composes these into frames; intro.ts and events.ts
// build the one-shot sequences on top.

import type { Pellet, StateId } from '../core.ts'

export const W = 44
export const H = 20

export const PALETTE: Record<string, number> = {
  k: 0x0e0c0d, // outline
  m: 0x3a3236, // bandit mask (charcoal, not black: black read as a skull)
  g: 0x8c7f70, // fur
  h: 0xb9ab98, // light fur / belly
  d: 0x5d5348, // dark fur / paws / rings
  w: 0xeee6d6, // cream
  W: 0xfffaf0, // tooth / star white
  e: 0xf3d247, // eye
  p: 0xc0716a, // pink
  r: 0xd02b2b, // bandana
  R: 0x8f1d1d, // bandana shade
  o: 0xff9d1c, // pellet
  y: 0xffe27a, // pellet glow
  O: 0xb85c00, // dark orange
  t: 0x6d727c, // can
  T: 0x3a3d45, // can dark
  q: 0xa3a9b4, // can rim / lid
  u: 0x8f4f2c, // rust
  n: 0x6a4220, // belt / stick
  Y: 0xe8c23a, // buckle / "!" pop / gold
  s: 0x6ec6ff, // sweat / water
  a: 0xdff4ff, // sweat shine
  c: 0xe8e8ee, // burp puff / motion ticks
  Z: 0x9fb4ff, // zzz
  b: 0x9a6a3a, // stick highlight
  N: 0x2b2024, // nose pad
  l: 0xd6c8b2, // muzzle (warm light fur: lighter than h, never stark white)
  j: 0x6b2c2a, // open-mouth interior (dark red-brown, never black)
}

/** Chars that never get an auto outline (glows, puffs, water, effects). */
export const NO_OUTLINE = new Set(['o', 'y', 'Z', 'c', 's', 'a', 'W'])

export class Grid {
  w: number
  h: number
  px: string[][]
  ox = 0
  oy = 0
  constructor(w: number, h: number) {
    this.w = w
    this.h = h
    this.px = Array.from({ length: h }, () => Array<string>(w).fill('.'))
  }
  set(x: number, y: number, c: string) {
    const X = Math.round(x) + this.ox
    const Y = Math.round(y) + this.oy
    if (X < 0 || Y < 0 || X >= this.w || Y >= this.h) return
    this.px[Y]![X] = c
  }
  get(x: number, y: number): string {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return '.'
    return this.px[y]![x]!
  }
  rect(x0: number, y0: number, x1: number, y1: number, c: string) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, c)
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: string) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx
        const dy = (y - cy) / ry
        if (dx * dx + dy * dy <= 1) this.set(x, y, c)
      }
  }
  /** Stamp a literal; '.' is clear. */
  stamp(x0: number, y0: number, art: readonly string[]) {
    art.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] !== '.') this.set(x0 + x, y0 + y, row[x]!)
    })
  }
  line(x0: number, y0: number, x1: number, y1: number, size: number, c: string) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n)
      const y = Math.round(y0 + ((y1 - y0) * i) / n)
      for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) this.set(x + dx, y + dy, c)
    }
  }
  outline() {
    const add: Array<[number, number]> = []
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.px[y]![x] !== '.') continue
        const near = [this.get(x - 1, y), this.get(x + 1, y), this.get(x, y - 1), this.get(x, y + 1)]
        if (near.some(c => c !== '.' && !NO_OUTLINE.has(c))) add.push([x, y])
      }
    for (const [x, y] of add) this.px[y]![x] = 'k'
  }
  /** Replace every pixel of one char with another (palette swaps: golden fur, drained glow). */
  swap(from: string, to: string) {
    for (const row of this.px) for (let x = 0; x < row.length; x++) if (row[x] === from) row[x] = to
  }
  rows(): string[] {
    return this.px.map(r => r.join(''))
  }
}

// ---- the head (13 x 10, front view) -----------------------------------
// Cute scrappy raccoon, not a skull: a charcoal mask band that tapers out to
// the cheeks, bead eyes with a shine, cream brows, a light-fur muzzle (not
// white), a small dark nose pad with a pink glint, fluffy cheek tufts, and a
// CLOSED smirk with ONE snaggle tooth at the corner. The mouth only opens to
// eat, gasp, sneeze or "bleh", and then it is red-brown inside, never black.

export const HEAD_W = 13
const HEAD = [
  '.gg.......gg.',
  'gdgggdddgggdg',
  'ggwwwgdgwwwgg',
  'gmmmmgdgmmmmg',
  'mmkWmhdhmkWmm',
  'gmkkmhlhmkkmg',
  'hhgmlNNNlmghh',
  'hhhlllklllhhh',
  '.hhllkllkkhh.',
  '..hhhWhhhhh..',
]
type Px = Array<[number, number, string]>
/** Eye patches: [row4 left, row5 left, row4 right, row5 right] at cols 2-3 and 9-10. */
const EYE_ART = {
  normal: ['kW', 'kk', 'kW', 'kk'], // bead eyes with a shine
  wide: ['ww', 'kw', 'ww', 'kw'], // hungry: whites showing, pupils down toward the can
  closed: ['mm', 'kk', 'mm', 'kk'],
  happy: ['kk', 'mm', 'kk', 'mm'],
  lidded: ['gg', 'kW', 'gg', 'kW'],
  annoyed: ['mm', 'wk', 'mm', 'kw'],
  up: ['kW', 'mm', 'kW', 'mm'], // pupils rolled up: peering at the prompt
  sparkle: ['WY', 'YW', 'YW', 'WY'], // star-struck
  left: ['kw', 'kw', 'kw', 'kw'],
  right: ['wk', 'wk', 'wk', 'wk'],
  dizzy: ['Wm', 'mW', 'mW', 'Wm'],
  squint: ['mm', 'kk', 'mm', 'kk'],
} satisfies Record<string, [string, string, string, string]>
/** Brow overrides (rows 2-3). */
const BROWS = {
  hungry: [[2, 2, 'g'], [4, 3, 'w'], [10, 2, 'g'], [8, 3, 'w']],
  annoyed: [[3, 2, 'g'], [4, 2, 'g'], [3, 3, 'w'], [4, 3, 'w'], [9, 2, 'g'], [8, 2, 'g'], [9, 3, 'w'], [8, 3, 'w']],
  bored: [[2, 2, 'g'], [3, 2, 'g'], [4, 2, 'g'], [8, 2, 'g'], [9, 2, 'g'], [10, 2, 'g'], [2, 3, 'h'], [3, 3, 'h'], [9, 3, 'h'], [10, 3, 'h']],
  raised: [[2, 1, 'w'], [3, 1, 'w'], [4, 1, 'w'], [8, 1, 'w'], [9, 1, 'w'], [10, 1, 'w'], [2, 2, 'g'], [3, 2, 'g'], [4, 2, 'g'], [8, 2, 'g'], [9, 2, 'g'], [10, 2, 'g']],
} satisfies Record<string, Px>
/**
 * Mouths replace rows 7-9 (the nose stays on row 6). Closed mouths are a
 * short smirk line that hooks up at the right corner, with the one snaggle
 * tooth 'W' poking down under the left end. Open mouths are 'j' inside.
 */
const MOUTH_ART = {
  grin: ['hhhlllkllkhhh', '.hhllklkklhh.', '..hhhWhhhhh..'],
  chew0: ['hhhlllklllhhh', '.hhllkkkllhh.', '..hhhhWhhhh..'],
  chew1: ['hhhlllklllhhh', '.hhlllkkllhh.', '..hhhhhWhhh..'],
  open: ['hhhlkkkkklhhh', '.hhlkWjjklhh.', '..hhhkkkhhh..'],
  burp: ['hhhllkkkllhhh', '.hhlkjjjklhh.', '..hhhkkkhhh..'],
  tongue: ['hhhlkkkkklhhh', '.hhlkjppklhh.', '..hhhkppkhh..'],
  flat: ['hhhlllklllhhh', '.hhlkkkkklhh.', '..hhhhhhWhh..'],
  grit: ['hhhlllklllhhh', '.hhkkkkkkkhh.', '..hhhhhhWhh..'],
  gasp: ['hhhllkkkllhhh', '.hhllkjkllhh.', '..hhhhkhhhh..'],
  smile: ['hhhlklklklhhh', '.hhllkkkllhh.', '..hhhWhhhhh..'],
  bleh: ['hhhlkkkkklhhh', '.hhlkjjjklhh.', '..hhhhppkhh..'],
  sneeze: ['hhhlllklllhhh', '.hhlkkkkklhh.', '..hhhhhhhhh..'],
} as const
export type Eyes = keyof typeof EYE_ART
export type Mouth = keyof typeof MOUTH_ART
export type Brow = keyof typeof BROWS

export type HeadOpts = {
  brow?: Brow
  /** Right ear flicks outward for a beat. */
  ear?: boolean
  /** Lean the head: +1 tilts right (right side drops 1 px), -1 tilts left. */
  tilt?: -1 | 0 | 1
  /** Lid helmet over the ears. */
  helmet?: boolean
  /** Rows to drop (chin tucked) for nods and sneezes. */
  squash?: number
}

export function head(g: Grid, hx: number, hy: number, eyes: Eyes, mouth: Mouth, opts: HeadOpts = {}) {
  const rows = HEAD.map(r => r.split(''))
  const put = (x: number, y: number, c: string) => {
    rows[y]![x] = c
  }
  const ea = EYE_ART[eyes]
  put(2, 4, ea[0][0]!), put(3, 4, ea[0][1]!), put(2, 5, ea[1][0]!), put(3, 5, ea[1][1]!)
  put(9, 4, ea[2][0]!), put(10, 4, ea[2][1]!), put(9, 5, ea[3][0]!), put(10, 5, ea[3][1]!)
  if (opts.brow) for (const [x, y, c] of BROWS[opts.brow] as Px) put(x, y, c)
  MOUTH_ART[mouth].forEach((row, i) => {
    rows[7 + i] = row.split('')
  })
  if (opts.ear) put(10, 0, '.'), put(11, 0, '.')
  rows.forEach((row, y) => {
    row.forEach((c, x) => {
      if (c === '.') return
      const lean = opts.tilt ? (opts.tilt > 0 ? (x >= 7 ? 1 : 0) : x <= 5 ? 1 : 0) : 0
      g.set(hx + x, hy + y + lean, c)
    })
  })
  // cheek fluff: a tuft sticks out past each jaw so the face reads fuzzy, not bony
  const lt = opts.tilt && opts.tilt < 0 ? 1 : 0
  const rt = opts.tilt && opts.tilt > 0 ? 1 : 0
  g.set(hx - 1, hy + 7 + lt, 'h')
  g.set(hx + 13, hy + 7 + rt, 'h')
  if (opts.ear) {
    // right ear flicks: it perks up and out 2 px for one beat (reads at 1x)
    for (const [x, y, c] of [[11, 0, 'g'], [11, -1, 'g'], [12, -1, 'd'], [12, 0, 'g'], [12, -2, 'g'], [13, -2, 'g'], [13, -1, 'g']] as Px) g.set(hx + x, hy + y + rt, c)
  }
  if (opts.helmet) helmet(g, hx, hy)
}

/** The can lid worn as a helmet: a dome over the ears with a brim and a handle knob. */
const HELMET = [
  '.....qq......',
  '..qqqqqqqqq..',
  '.qqqqqqqqqqT.',
  'TqqqqqqqqqqqT',
]
function helmet(g: Grid, hx: number, hy: number) {
  g.stamp(hx, hy - 1, HELMET)
}

/** Neckerchief: a band across the neck plus a triangle that hangs below. */
export function bandana(g: Grid, cx: number, y: number, w: number, drop: number) {
  const x0 = cx - (w >> 1)
  for (let x = 0; x < w; x++) g.set(x0 + x, y, x % 3 === 2 ? 'R' : 'r')
  for (let i = 1; i <= drop; i++) {
    const ww = Math.max(1, w - 2 - 2 * i)
    const xs = cx - (ww >> 1)
    for (let x = 0; x < ww; x++) g.set(xs + x, y + i, x === ww - 1 && ww > 2 ? 'R' : 'r')
  }
  // knot tails flicking out to the right
  g.set(x0 + w, y, 'r')
  g.set(x0 + w + 1, y - 1, 'R')
}

// ---- tail: ringed, bushy, dark tip -----------------------------------

const TAIL_THIN = [
  '.........mm',
  '........dmm',
  '......hhd..',
  '..ddhhdd...',
  'hhddhh.....',
]
const TAIL_THIN_UP = [
  '........mm.',
  '.......mmm.',
  '.......dd..',
  '......hhd..',
  '.....dhh...',
  '..hhdd.....',
  'hhdd.......',
]
const TAIL_MID = [
  '...mm',
  '..mmm',
  '..hhh',
  '.hhhh',
  '.ddd.',
  'dddd.',
  'hhh..',
  'hhh..',
  'dd...',
]
const TAIL_BIG = [
  '....mm.',
  '...mmmm',
  '...hhhh',
  '..hhhhh',
  '..dddd.',
  '.ddddd.',
  '.hhhh..',
  'hhhhh..',
  'dddd...',
  'ddd....',
]
const TAIL_FLAT = ['.mhhddhh', 'mmhhddhh']
export const TAILS = { TAIL_THIN, TAIL_THIN_UP, TAIL_MID, TAIL_BIG, TAIL_FLAT }

/**
 * Stamp a tail. `swish` shears it: the base stays planted and the tip swings
 * (1 = tip leans in over the back, 2 = tip flicks out).
 */
export function tail(g: Grid, x: number, y: number, art: readonly string[], swish: 0 | 1 | 2 = 0) {
  const n = art.length
  const amp = swish === 1 ? -2 : swish === 2 ? 1 : 0
  art.forEach((row, r) => {
    const k = n > 1 ? (n - 1 - r) / (n - 1) : 0
    const sx = Math.round(amp * k * k)
    for (let i = 0; i < row.length; i++) if (row[i] !== '.') g.set(x + i + sx, y + r, row[i]!)
  })
}

// ---- props -----------------------------------------------------------

/** A 3x3 pellet: orange cross with a glowing centre (`core` picks y / w / o for the shimmer). */
export function pellet(g: Grid, x: number, y: number, core: string = 'y') {
  g.set(x + 1, y, core === 'w' ? 'y' : 'o')
  g.set(x, y + 1, 'o')
  g.set(x + 2, y + 1, 'o')
  g.set(x + 1, y + 2, 'o')
  g.set(x + 1, y + 1, core)
}

/** The golden pellet: bigger, gold, white-hot core. */
export function goldPellet(g: Grid, x: number, y: number) {
  g.stamp(x, y, ['.Y.', 'YWY', '.Y.'])
  g.set(x + 1, y - 1, 'y')
  g.set(x - 1, y + 1, 'y')
  g.set(x + 3, y + 1, 'y')
  g.set(x + 1, y + 3, 'y')
}

export const SLOTS: Array<[number, number]> = [
  [10, 16], [13, 17], [16, 16], [19, 17], [12, 14], [14, 13], [17, 14], [8, 17], [20, 15],
]
export const PILE: Record<StateId, number> = { asleep: 0, skinny: 9, snacking: 7, round: 5, huge: 3, bloated: 2, coma: 1, workout: 6 }

const SHIMMER = ['y', 'w', 'y', 'o']
/** The floor pile. `phase` walks a glint across the pellets (the shimmer). */
export function pile(g: Grid, n: number, phase: number) {
  for (let i = 0; i < Math.min(n, SLOTS.length); i++) {
    const [x, y] = SLOTS[i]!
    pellet(g, x, y, SHIMMER[(((i * 3 + phase) % 4) + 4) % 4]!)
  }
}

/** The tipped trash can, mouth to the right, spilling glow. */
export const CAN = [
  '.ttttttq...',
  'tutTttTqq..',
  'ttuTttTqOq.',
  'TttTtuTqOOq',
  'TttTttTqOyq',
  'TttTttTqOOq',
  'TtuTttTqOOq',
  'TttTuuTqOq.',
  'TTTTTTTqq..',
  '.TTTTTTq...',
]
/** Same can, licked clean: dark inside, one crumb on the lip. */
export const CAN_DRAINED = [
  '.ttttttq...',
  'tutTttTqq..',
  'ttuTttTqTq.',
  'TttTtuTqmTq',
  'TttTttTqmmq',
  'TttTttTqmTq',
  'TtuTttTqTOq',
  'TttTuuTqTq.',
  'TTTTTTTqq..',
  '.TTTTTTq...',
]
/** The lid after the intro: lying on the fallen can, handle up. */
const LID_REST = ['...qT...', 'Tqqqqqqq']
export const CAN_X = 0
export const CAN_Y = 10

export type CanOpts = { dx?: number; dy?: number; drained?: boolean; lid?: boolean }
export function can(g: Grid, o: CanOpts = {}) {
  const dx = o.dx ?? 0
  const dy = o.dy ?? 0
  g.stamp(CAN_X + dx, CAN_Y + dy, o.drained ? CAN_DRAINED : CAN)
  if (o.lid !== false) g.stamp(CAN_X + 1 + dx, CAN_Y - 2 + dy, LID_REST)
}

/**
 * The can standing upright with its lid on (10 x 13): the tipped can turned
 * mouth-up, so the rotation in the intro lands on the hand-drawn tipped can.
 */
export const UPRIGHT_CAN: readonly string[] = [
  '....qT....',
  '.qqqqqqqq.',
  'qqqqqqqqqT',
  '.tqqqqqqT.',
  '.ttttttTT.',
  'tTTTTTTTTT',
  'tttutttTTT',
  'ttuttttTTT',
  'tttttuttTT',
  'tTTTTTTTTT',
  'tutttttuTT',
  'ttttutttTT',
  '.ttttttTT.',
]
export const UPRIGHT_X = 0
export const UPRIGHT_Y = H - UPRIGHT_CAN.length // standing on the floor
/** The lid on its own (in flight / in a paw), plus tilted and edge-on views. */
export const LID = ['...qT...', '.qqqqqq.', 'TqqqqqqT']
export const LID_TILT = ['.....qq', '...qqqT', '.qqqq..', 'Tqq....']
export const LID_TILT_R = ['qq.....', 'Tqqq...', '..qqqq.', '....qqT']
export const LID_EDGE = ['q', 'q', 'T', 'q', 'q']

const ZED = ['ZZZ', '.ZZ', 'ZZZ']
export function zed(g: Grid, x: number, y: number, big = true) {
  if (big) g.stamp(x, y, ['ZZZZ', '..ZZ', 'ZZ..', 'ZZZZ'])
  else g.stamp(x, y, ZED)
}

export function sweat(g: Grid, x: number, y: number) {
  g.set(x, y, 's')
  g.set(x - 1, y + 1, 's')
  g.set(x, y + 1, 'a')
  g.set(x + 1, y + 1, 's')
  g.set(x, y + 2, 's')
}

/** A 4-point sparkle (centre + arms), drawn after the outline. */
export function star(g: Grid, x: number, y: number, big = false, c = 'W') {
  g.set(x, y, c)
  const arm = c === 'W' ? 'y' : c
  g.set(x - 1, y, arm), g.set(x + 1, y, arm), g.set(x, y - 1, arm), g.set(x, y + 1, arm)
  if (big) g.set(x - 2, y, arm), g.set(x + 2, y, arm), g.set(x, y - 2, arm), g.set(x, y + 2, arm)
}

/** A yellow "!" pop (4 px bar + dot). */
export function bang(g: Grid, x: number, y: number) {
  g.rect(x, y, x, y + 2, 'Y')
  g.set(x, y + 4, 'Y')
}

/** A yellow "?" pop. */
export function query(g: Grid, x: number, y: number) {
  g.stamp(x, y, ['YYY', '..Y', '.YY', '.Y.', '...', '.Y.'])
}

/** Sole-out foot: dark paw with pink pads (like the reference). */
const FOOT_L = ['.ddd.', 'dpdpd', 'dpppd', '.ddd.']
const FOOT_S = ['.dd.', 'dppd', '.dd.']
export function foot(g: Grid, x: number, y: number, big = true) {
  g.stamp(x, y, big ? FOOT_L : FOOT_S)
}

// ---- anchors (shared by idle, poke, intro and events) ------------------

export const HEAD_X = 21
export const HEAD_POS: Record<StateId, Pellet> = {
  asleep: { x: 15, y: 5 },
  skinny: { x: 15, y: 5 },
  snacking: { x: 21, y: 1 },
  round: { x: 21, y: 1 },
  huge: { x: 21, y: 1 },
  bloated: { x: 21, y: 2 },
  coma: { x: 30, y: 5 },
  workout: { x: 21, y: 1 },
}
/** Mouth centre per state (pellets are aimed here): head x + 6, head y + 8. */
export const MOUTH: Record<StateId, Pellet> = Object.fromEntries(
  Object.entries(HEAD_POS).map(([s, p]) => [s, { x: p.x + 6, y: p.y + 8 }]),
) as Record<StateId, Pellet>
/** Free arms: where each shoulder starts, per body (L = screen-left, toward the can). */
export const SHOULDER_L: Record<StateId, Pellet> = {
  asleep: { x: 19, y: 15 },
  skinny: { x: 19, y: 15 },
  snacking: { x: 22, y: 11 },
  round: { x: 20, y: 11 },
  huge: { x: 17, y: 11 },
  bloated: { x: 14, y: 11 },
  coma: { x: 14, y: 8 },
  workout: { x: 23, y: 12 },
}
export const SHOULDER_R: Record<StateId, Pellet> = {
  asleep: { x: 24, y: 15 },
  skinny: { x: 24, y: 15 },
  snacking: { x: 32, y: 11 },
  round: { x: 33, y: 12 },
  huge: { x: 37, y: 11 },
  bloated: { x: 40, y: 11 },
  coma: { x: 26, y: 8 },
  workout: { x: 31, y: 12 },
}

/** Arm from a shoulder to a paw (2 px fur, 1 px on skinny), with a dark 2x2 paw. */
export function arm(g: Grid, state: StateId, from: Pellet, paw: Pellet, outlined = true) {
  const thin = state === 'skinny' || state === 'asleep' || state === 'workout'
  const size = thin ? 1 : 2
  // an outline along the outer 60% so a paw in front of the belly or face still reads
  const sx = Math.round(from.x + (paw.x - from.x) * 0.4)
  const sy = Math.round(from.y + (paw.y - from.y) * 0.4)
  if (outlined) g.line(sx - 1, sy - 1, paw.x - 1, paw.y - 1, size + 2, 'k')
  g.line(from.x, from.y, paw.x, paw.y, size, 'g')
  if (thin) g.rect(paw.x, paw.y, paw.x + 1, paw.y, 'd')
  else g.rect(paw.x, paw.y, paw.x + 1, paw.y + 1, 'd')
}

// ---- bodies ------------------------------------------------------------

export type BodyOpts = {
  /** Base pose within the state's idle loop (old frame index). */
  pose?: number
  eyes?: Eyes
  mouth?: Mouth
  brow?: Brow
  /** 'pose' draws the state's own arms; 'none' leaves both free for props; 'right' keeps only the resting right arm. */
  arms?: 'pose' | 'none' | 'right'
  blink?: boolean
  ear?: boolean
  tail?: 0 | 1 | 2
  jiggle?: number
  headDx?: number
  headDy?: number
  tilt?: -1 | 0 | 1
  helmet?: boolean
  bandana?: boolean
  /** Whole-body offset (waddling in the intro). */
  dx?: number
  dy?: number
}

/** Squash/stretch of the belly after a burst lands: [rx, ry, cy, head drop]. */
const JIGGLE: Array<[number, number, number, number]> = [
  [1.3, -0.8, 0.5, 1],
  [-0.8, 0.6, -0.4, 0],
  [0.7, -0.4, 0.2, 0],
  [0.25, -0.1, 0, 0],
]
export const JIGGLE_FRAMES = JIGGLE.length
function jig(o: BodyOpts): [number, number, number, number] {
  return o.jiggle === undefined ? [0, 0, 0, 0] : JIGGLE[((o.jiggle % JIGGLE.length) + JIGGLE.length) % JIGGLE.length]!
}

function face(o: BodyOpts, eyes: Eyes, mouth: Mouth, brow?: Brow): [Eyes, Mouth, Brow | undefined] {
  const e = o.eyes ?? eyes
  return [o.blink && e !== 'closed' ? 'closed' : e, o.mouth ?? mouth, o.blink ? undefined : (o.brow ?? brow)]
}

function drawHead(g: Grid, state: StateId, o: BodyOpts, eyes: Eyes, mouth: Mouth, brow: Brow | undefined, extraDy = 0) {
  const p = HEAD_POS[state]
  head(g, p.x + (o.headDx ?? 0), p.y + (o.headDy ?? 0) + extraDy, eyes, mouth, { brow, ear: o.ear, tilt: o.tilt, helmet: o.helmet })
}

// Skinny: HUNCHED. A bony ribcage arching higher than the head, the head
// pushed forward and low toward the can, ribs on the flank, a thin waist, a
// bent haunch, and long arms dangling to the floor with claws. Hungry.
const TAIL_HOOK = ['..mm', '.mmd', '.dh.', '.hd.', 'dh..', 'hd..', 'd...']
const TAIL_DROOP = ['......dh', '...ddhh.', 'mmdh....']
function skinnyHunched(g: Grid, state: StateId, o: BodyOpts) {
  const [, , , jdrop] = jig(o)
  const bob = o.jiggle === undefined ? 0 : [1, 0, 0, 0][o.jiggle % 4]!
  g.ox = o.dx ?? 0
  g.oy = o.dy ?? 0
  const pose = o.pose ?? 0
  const sleepy = state === 'asleep'
  if (sleepy) tail(g, 37, 10, TAIL_DROOP, o.tail ?? 0)
  else tail(g, 39, 2, TAIL_HOOK, o.tail ?? (pose === 1 ? 2 : 0))
  // hind leg: bony haunch, knee forward, shin back, big flat foot
  g.ellipse(36, 11 + bob, 2.6, 2.4, 'g')
  g.line(35, 13, 33, 16, 1, 'g')
  g.line(33, 16, 35, 18, 1, 'g')
  g.rect(34, 19, 37, 19, 'd')
  // far hind leg peeking
  g.line(38, 13, 39, 18, 1, 'd')
  g.rect(38, 19, 40, 19, 'd')
  // ribcage: arched high behind the head, belly tucked up to a thin waist
  g.ellipse(31, 7.5 + bob, 6, 4.8, 'g')
  g.ellipse(31, 6.3 + bob, 4.6, 2.8, 'd')
  g.ellipse(31, 5.9 + bob, 4.6, 2.8, 'g')
  for (const x of [29, 31, 33]) g.line(x, 8 + bob, x, 11 + bob, 1, 'd')
  for (const x of [30, 32]) g.line(x, 8 + bob, x, 10 + bob, 1, 'h')
  g.line(27, 12 + bob, 34, 12 + bob, 1, 'g')
  // front legs under the chest
  g.line(27, 12, 27, 18, 1, 'g')
  g.rect(26, 19, 28, 19, 'd')
  // neck: forward and down into the head
  g.line(27, 5 + bob, 23, 10, 2, 'g')
  if (o.arms !== 'none') {
    // far arm, mostly hidden
    g.line(24, 15, 24, 18, 1, 'd')
    g.rect(23, 19, 24, 19, 'd')
  }
  if (o.arms === 'pose' || o.arms === undefined) {
    // near arm: long, dangling past the knees, claws on the floor
    g.line(19, 15, 18, 18, 1, 'g')
    g.rect(17, 19, 19, 19, 'd')
  }
  const [eyes, mouth, brow] = sleepy
    ? face(o, 'closed', 'chew1')
    : face(o, 'wide', pose === 1 ? 'tongue' : 'grin', 'hungry')
  drawHead(g, state, o, eyes, mouth, brow, jdrop + bob)
  if (o.bandana !== false) bandana(g, 21 + (o.headDx ?? 0), 15 + (o.headDy ?? 0) + jdrop + bob, 7, 1)
  g.ox = 0
  g.oy = 0
}

// Workout keeps the old upright skinny: jumping jacks need a straight back.
const SKINNY_TORSO = [
  '.ggggggg.',
  'gg.hhh.gg',
  '.g.ddd.g.',
  '.g.hhh.g.',
  '.g.ddd.g.',
  '.g..g..g.',
  '.d.....d.',
]
function skinnyUpright(g: Grid, up: boolean, o: BodyOpts) {
  const lift = up ? 1 : 0
  if (up) tail(g, 30, 12, TAIL_THIN_UP)
  else tail(g, 30, 14, TAIL_THIN)
  if (up) {
    g.line(26, 17, 22, 18, 1, 'g')
    g.line(28, 17, 32, 18, 1, 'g')
    g.rect(19, 18, 21, 18, 'd')
    g.rect(33, 18, 35, 18, 'd')
    // shadow on the floor while airborne
    g.rect(21, 19, 33, 19, 'T')
  } else {
    g.set(26, 17, 'g'), g.set(25, 18, 'g'), g.set(24, 18, 'g'), g.set(24, 19, 'd'), g.set(23, 19, 'd'), g.set(22, 19, 'd')
    g.set(28, 17, 'g'), g.set(29, 18, 'g'), g.set(30, 18, 'g'), g.set(30, 19, 'd'), g.set(31, 19, 'd'), g.set(32, 19, 'd')
  }
  void lift
  if (up) {
    g.stamp(23, 11, SKINNY_TORSO.slice(0, 6).map(r => '..' + r.slice(2, 7) + '..'))
    g.line(23, 12, 19, 5, 1, 'g')
    g.line(31, 12, 35, 5, 1, 'g')
    g.rect(18, 3, 19, 4, 'd')
    g.rect(35, 3, 36, 4, 'd')
  } else g.stamp(23, 11, SKINNY_TORSO)
  const [eyes, mouth, brow] = face(o, up ? 'happy' : 'normal', 'grin')
  head(g, HEAD_X, HEAD_POS.workout.y, eyes, mouth, { brow })
  bandana(g, 27, HEAD_POS.workout.y + 10, 7, 1)
}

function snacking(g: Grid, o: BodyOpts) {
  const f = o.pose ?? 0
  const [jrx, jry, jcy, jdrop] = jig(o)
  g.ox = o.dx ?? 0
  g.oy = o.dy ?? 0
  tail(g, 33, 8, TAIL_MID, o.tail ?? 0)
  g.ellipse(27, 14.6 + jcy, 6.6 + jrx, 5 + jry, 'd')
  g.ellipse(26.6, 14 + jcy, 5.8 + jrx, 4.4 + jry, 'g')
  g.ellipse(27, 15.3 + jcy, 3.6 + jrx * 0.7, 3.1 + jry * 0.7, 'h')
  g.set(27, 16, 'd')
  foot(g, 20, 16, false)
  foot(g, 31, 16, false)
  if (o.arms !== 'none') {
    // resting arm on the belly (screen right)
    g.line(32, 11, 32, 14, 1, 'g')
    g.rect(31, 15, 32, 15, 'd')
  }
  if (o.arms === 'pose' || o.arms === undefined) {
    if (f === 0) {
      g.line(22, 11, 15, 15, 2, 'g')
      g.rect(13, 15, 14, 16, 'd')
    } else if (f === 1) {
      g.line(21, 12, 23, 11, 2, 'g')
    } else {
      g.line(22, 11, 22, 14, 1, 'g')
      g.rect(22, 15, 23, 15, 'd')
    }
  }
  const [eyes, mouth, brow] = face(o, f === 1 ? 'wide' : f === 0 ? 'normal' : 'happy', f === 0 ? 'grin' : f === 1 ? 'open' : f === 2 ? 'chew0' : 'chew1')
  drawHead(g, 'snacking', o, eyes, mouth, brow, jdrop)
  if (o.bandana !== false) bandana(g, 27 + (o.headDx ?? 0), 11 + (o.headDy ?? 0) + jdrop, 9, 2)
  if (f === 1 && (o.arms === 'pose' || o.arms === undefined)) {
    g.rect(22, 10, 23, 11, 'd')
    pellet(g, 23, 8)
  }
  g.ox = 0
  g.oy = 0
}

function round(g: Grid, o: BodyOpts) {
  const f = o.pose ?? 0
  const [jrx, jry, jcy, jdrop] = jig(o)
  g.ox = o.dx ?? 0
  g.oy = o.dy ?? 0
  tail(g, 34, 7, TAIL_BIG, o.tail ?? 0)
  g.ellipse(27, 14.2 + jcy, 9.2 + jrx, 5.8 + jry, 'd')
  g.ellipse(26.6, 13.5 + jcy, 8.4 + jrx, 5.2 + jry, 'g')
  g.ellipse(27, 15 + jcy, 5.8 + jrx * 0.8, 3.9 + jry * 0.8, 'h')
  g.set(27, 16, 'd')
  g.set(21, 12, 'd'), g.set(33, 13, 'd'), g.set(23, 18, 'd'), g.set(31, 18, 'd')
  foot(g, 17 - Math.round(jrx * 0.6), 15)
  foot(g, 33 + Math.round(jrx * 0.6), 15)
  const [eyes, mouth, brow] = face(o, 'happy', f === 0 ? 'chew0' : f === 1 ? 'open' : 'chew1')
  drawHead(g, 'round', o, eyes, mouth, brow, jdrop)
  if (o.bandana !== false) bandana(g, 27 + (o.headDx ?? 0), 11 + (o.headDy ?? 0) + jdrop, 11, 2)
  if (o.arms === 'pose' || o.arms === undefined) {
    // paws holding the pellet up to the mouth
    g.line(20, 13, 23, 12, 2, 'g')
    g.rect(23, 11, 24, 12, 'd')
    g.line(33, 13, 30, 12, 2, 'g')
    g.rect(30, 11, 31, 12, 'd')
    if (f === 0) pellet(g, 26, 10, 'w')
    else if (f === 1) {
      g.set(27, 11, 'o')
      g.set(26, 12, 'o')
      g.set(27, 12, 'y')
      g.set(28, 12, 'o')
    } else g.set(27, 12, 'o')
  } else if (o.arms === 'right') {
    g.line(33, 13, 33, 15, 2, 'g')
    g.rect(32, 16, 33, 16, 'd')
  }
  g.ox = 0
  g.oy = 0
}

function huge(g: Grid, o: BodyOpts) {
  const f = o.pose ?? 0
  const [jrx, jry, jcy, jdrop] = jig(o)
  g.ox = o.dx ?? 0
  g.oy = o.dy ?? 0
  tail(g, 36, 5, TAIL_BIG, o.tail ?? 0)
  const rx = 12 + jrx
  const ry = 6.2 + jry
  const cy = 13.8 + jcy
  g.ellipse(27, cy, rx, ry, 'd')
  g.ellipse(26.6, cy - 0.7, rx - 0.7, ry - 0.6, 'g')
  g.ellipse(27, cy + 0.6, 8.4 + jrx, 4.4 + jry, 'h')
  // straining belt
  for (let x = 14; x <= 40; x++)
    for (const y of [15, 16]) {
      const dx = (x - 27) / rx
      const dy = (y - cy) / ry
      if (dx * dx + dy * dy <= 1) g.set(x, y, 'n')
    }
  g.rect(25, 15, 29, 16, 'Y')
  g.rect(26, 15, 28, 15, 'n')
  g.set(27, 16, 'n')
  for (const x of [19, 35]) g.set(x, 15, 'k')
  for (const x of [21, 24, 30, 33]) g.set(x, 13, 'd')
  for (const x of [22, 32]) g.set(x, 18, 'd')
  foot(g, 14 - Math.round(jrx * 0.5), 16)
  foot(g, 36 + Math.round(jrx * 0.5), 16)
  if (o.arms !== 'none') {
    g.ellipse(37.5, 12, 1.6, 2.6, 'g')
    g.rect(37, 14, 38, 14, 'd')
  }
  if (o.arms === 'pose' || o.arms === undefined) {
    g.ellipse(16.5, 12, 1.6, 2.6, 'g')
    g.rect(16, 14, 17, 14, 'd')
  }
  const [eyes, mouth, brow] = face(o, 'lidded', 'chew0')
  drawHead(g, 'huge', o, eyes, mouth, brow, jdrop)
  if (o.bandana !== false) bandana(g, 27 + (o.headDx ?? 0), 11 + (o.headDy ?? 0) + jdrop, 11, 1)
  void f
  g.ox = 0
  g.oy = 0
}

/** The huge sweat drip: forms at the temple, rolls down the cheek, drops, splats on the shoulder. */
export const DRIP_STEPS = 8
export function drip(g: Grid, step: number) {
  const s = ((step % DRIP_STEPS) + DRIP_STEPS) % DRIP_STEPS
  if (s === 0) g.set(34, 3, 'a')
  else if (s === 1) g.set(34, 3, 's'), g.set(34, 4, 'a')
  else if (s === 2) g.set(35, 4, 's'), g.set(35, 5, 'a')
  else if (s === 3) g.set(35, 6, 's'), g.set(35, 7, 'a')
  else if (s === 4) g.set(36, 8, 's'), g.set(36, 9, 'a')
  else if (s === 5) g.set(35, 9, 's'), g.set(37, 9, 's'), g.set(36, 8, 'a')
  // 6, 7: dry beat before the next bead
}

function bloated(g: Grid, o: BodyOpts) {
  const f = o.pose ?? 0
  const [jrx, jry, jcy, jdrop] = jig(o)
  g.ox = o.dx ?? 0
  g.oy = o.dy ?? 0
  tail(g, 37, 3, TAIL_BIG.slice(0, 7), o.tail ?? 0)
  const breath = (f === 1 ? 0.7 : 0) + jrx
  const by = (f === 1 ? 0.35 : 0) + jry
  g.ellipse(27, 13.4 + jcy, 15 + breath, 6.6 + by, 'd')
  g.ellipse(26.6, 12.8 + jcy, 14.2 + breath, 6 + by, 'g')
  g.ellipse(27, 14 + jcy, 11 + breath, 5 + by, 'h')
  g.set(27, 15, 'd'), g.set(28, 15, 'd')
  for (const [x, y] of [[18, 12], [19, 16], [36, 12], [35, 16], [23, 18], [31, 18]] as Array<[number, number]>) g.set(x, y, 'd')
  // popped belt: scraps on the sides, buckle on the floor
  g.rect(12, 15, 14, 15, 'n')
  g.rect(40, 15, 42, 15, 'n')
  g.rect(36, 18, 37, 19, 'Y')
  foot(g, 11 - Math.round(jrx * 0.5), 16)
  foot(g, 39 + Math.round(jrx * 0.5), 16)
  if (o.arms !== 'none') g.ellipse(40, 11.5, 1.6, 2.4, 'g')
  if (o.arms === 'pose' || o.arms === undefined) g.ellipse(14, 11.5, 1.6, 2.4, 'g')
  const [eyes, mouth, brow] = face(o, 'lidded', f >= 2 ? 'burp' : 'chew0')
  drawHead(g, 'bloated', o, eyes, mouth, brow, jdrop)
  if (o.bandana !== false) bandana(g, 27 + (o.headDx ?? 0), 12 + (o.headDy ?? 0) + jdrop, 9, 1)
  g.ox = 0
  g.oy = 0
}

export function burpPuff(g: Grid, f: number) {
  if (f === 2) {
    g.ellipse(19, 8, 1.3, 1.1, 'c')
    g.ellipse(16, 6, 0.9, 0.9, 'c')
  } else if (f === 3) {
    g.ellipse(18, 7, 2.2, 1.8, 'c')
    g.ellipse(13, 4, 2, 1.7, 'c')
    g.ellipse(9, 2.5, 1.3, 1.2, 'c')
  }
}

function coma(g: Grid, o: BodyOpts) {
  const f = o.pose ?? 0
  tail(g, 4, 16, TAIL_FLAT)
  const b = f % 2 ? 0.6 : 0
  g.ellipse(21, 14.2, 12.8, 5.4 + b, 'd')
  g.ellipse(21, 13.6, 12.1, 4.8 + b, 'g')
  g.ellipse(21, 13.8, 9.4, 3.6 + b, 'h')
  g.set(21, 13, 'k'), g.set(20, 12, 'k'), g.set(22, 12, 'k'), g.set(20, 14, 'k'), g.set(22, 14, 'k')
  // belly-up legs, soles to the sky (toes twitch on the breath)
  for (const [x, y] of [[10, 3 + (f % 2)], [15, 2]] as Array<[number, number]>) {
    g.rect(x + 1, y + 3, x + 2, 9, 'g')
    foot(g, x, y, false)
  }
  g.rect(26, 7, 27, 10, 'g')
  g.rect(26, 6, 27, 6, 'd')
  // bandana bunched at the neck, head lolling back, tongue out
  g.rect(29, 11, 30, 16, 'r')
  g.rect(29, 13, 29, 15, 'R')
  head(g, HEAD_POS.coma.x, HEAD_POS.coma.y, 'closed', 'tongue', { ear: o.ear })
  const Z: Array<[number, number]> = [[30, 1], [35, 1], [40, 1]]
  Z.slice(0, f === 3 ? 3 : f + 1).forEach(([x, y], i) => zed(g, x, y + (i === 1 ? 0 : 1), i !== 2))
}

/** Draw a body for any state. Workout: pose 1 = arms up. */
export function drawBody(g: Grid, state: StateId, o: BodyOpts = {}) {
  switch (state) {
    case 'asleep':
    case 'skinny':
      return skinnyHunched(g, state, o)
    case 'snacking':
      return snacking(g, o)
    case 'round':
      return round(g, o)
    case 'huge':
      return huge(g, o)
    case 'bloated':
      return bloated(g, o)
    case 'coma':
      return coma(g, o)
    case 'workout':
      return skinnyUpright(g, (o.pose ?? 0) === 1, o)
  }
}

/** Wobble ticks beside the belly on the squash beats of a jiggle. */
export function jiggleTicks(g: Grid, state: StateId, k: number) {
  if (k !== 0 && k !== 2) return
  const half: Record<StateId, number> = { asleep: 6, skinny: 6, snacking: 8, round: 11, huge: 14, bloated: 17, coma: 0, workout: 0 }
  const r = half[state]
  if (!r) return
  const cx = state === 'skinny' || state === 'asleep' ? 31 : 27
  const y = state === 'skinny' || state === 'asleep' ? 10 : 13
  // skinny's head pokes out in front of the ribcage, so its left tick would land on the face
  for (const s of state === 'skinny' || state === 'asleep' ? [1] : [-1, 1]) {
    const x = cx + s * (r + 1)
    g.set(x, y, 'c'), g.set(x, y + 2, 'c')
    if (k === 0) g.set(x + s, y + 1, 'c')
  }
}
