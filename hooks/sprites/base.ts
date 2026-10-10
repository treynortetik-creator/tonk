// Tonk's pixel-art kit: palette, the Grid canvas, the head, tail, props, and
// every body. Frames are palette-indexed character grids (one char per pixel,
// '.' clear). sprites.ts composes these into frames; intro.ts and events.ts
// build the one-shot sequences on top.
//
// The character (art pass 5, from design/proto.py): a FRONT-FACING, sitting
// chibi raccoon. A 16 x 12 head (big ears, white brows, a dark mask band with
// 2 x 2 eyes = white glint + black pupil, a light muzzle, black nose, a smirk),
// a round sitting body whose width IS the usage meter, a light belly, dark
// paws and feet, a red neckerchief under the chin, and a ringed tail rising
// behind his right side.

import type { Pellet, StateId } from '../core.ts'

export const W = 44
export const H = 20

export const PALETTE: Record<string, number> = {
  k: 0x0e0c0d, // outline, pupils
  m: 0x2c2629, // bandit mask, tail rings
  g: 0x9a9184, // fur
  h: 0xc9bfae, // light fur / belly / cheeks
  d: 0x5d5348, // dark fur / paws / feet
  w: 0xf2ece0, // muzzle / brows
  W: 0xffffff, // eye glint / star white
  N: 0x1a1416, // nose
  p: 0xe0868a, // pink (tongue)
  j: 0x6b2c2a, // open-mouth interior (dark red-brown, never black)
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
  b: 0x9a6a3a, // stick highlight
  Y: 0xe8c23a, // buckle / "!" pop / gold
  s: 0x6ec6ff, // sweat / water
  a: 0xdff4ff, // sweat shine
  c: 0xe8e8ee, // burp puff / motion ticks
  Z: 0x9fb4ff, // zzz
}

/**
 * Chars that never spawn an auto outline: glows, puffs, water, effects, and
 * 'k' itself (the head and arms carry hand-placed outlines; letting them
 * spawn more would double every edge).
 */
export const NO_OUTLINE = new Set(['o', 'y', 'Z', 'c', 's', 'a', 'W', 'k'])

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
    for (let y = Math.floor(cy - ry) - 1; y <= Math.ceil(cy + ry) + 1; y++)
      for (let x = Math.floor(cx - rx) - 1; x <= Math.ceil(cx + rx) + 1; x++) {
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

// ---- the head (16 x 12, front view, outline baked in) ------------------

export const HEAD_W = 16
export const HEAD_H = 12
const HEAD = [
  '.kk..........kk.',
  'kgdk........kdgk',
  'kgdgkkkkkkkkgdgk',
  'kggggggggggggggk',
  'kgwwwggggggwwwgk',
  'kmmmmmmggmmmmmmk',
  'kmmWkmmhhmmWkmmk',
  'kmmkkmmhhmmkkmmk',
  'kkmmmhwwwwhmmmkk',
  'kkhhwwwNNwwwhhkk',
  '..khhwwwwwwhhk..',
  '...kkhwwwwhkk...',
]
type Px = Array<[number, number, string]>

/**
 * Eye patches, 4 px wide, starting at head row `r`: the left eye's patch
 * covers head cols 2-5, the right one 10-13. '.' keeps the base pixel.
 * The base eye is 2 x 2 at cols 3-4 / 11-12, rows 6-7: glint + pupil.
 */
type EyeArt = { r: number; L: string[]; R?: string[] }
const EYE_ART = {
  normal: { r: 6, L: ['mWkm', 'mkkm'] },
  wide: { r: 6, L: ['mwwm', 'mkwm'] }, // hungry: whites, pupils down toward the can
  closed: { r: 6, L: ['mmmm', 'hhhh'] },
  happy: { r: 6, L: ['mhhm', 'hmmh'] }, // ^ ^
  lidded: { r: 6, L: ['mggm', 'mWkm'] }, // heavy lids, full and sleepy
  annoyed: { r: 6, L: ['mmmm', 'mWkm'], R: ['mmmm', 'mWkm'] },
  up: { r: 6, L: ['mkkm', 'mwwm'] }, // pupils rolled up: peering at the prompt
  sparkle: { r: 5, L: ['.Y..', 'YWYm', 'mYmm'] }, // star-struck
  left: { r: 6, L: ['mkwm', 'mkwm'] },
  right: { r: 6, L: ['mwkm', 'mwkm'] },
  dizzy: { r: 5, L: ['w.w.', 'mwmm', 'wmwm'], R: ['.w.w', 'mmwm', 'mwmw'] }, // x x
  squint: { r: 6, L: ['mwwm', 'mmmm'] }, // >< scrunched
} satisfies Record<string, EyeArt>

/** Brow overrides [x, y, c] on the left side; the right side is mirrored (x -> 15 - x). */
const BROWS = {
  hungry: [[2, 4, 'w'], [3, 4, 'w'], [4, 4, 'g'], [4, 3, 'w']], // worried: inner ends up
  annoyed: [[2, 3, 'w'], [2, 4, 'g'], [3, 4, 'w'], [4, 4, 'w'], [5, 4, 'w'], [5, 5, 'w']], // inner ends down
  bored: [[2, 4, 'g'], [3, 4, 'g'], [4, 4, 'g'], [2, 5, 'w'], [3, 5, 'w'], [4, 5, 'w']], // low, flat
  raised: [[2, 3, 'w'], [3, 3, 'w'], [4, 3, 'w'], [2, 4, 'g'], [3, 4, 'g'], [4, 4, 'g']],
} satisfies Record<string, Px>

/**
 * Mouths: rows 10, 11, 12 (and 13) of the head, 16 wide, '.' keeps the base.
 * Row 12+ is the jaw dropping onto the neckerchief, so the head is drawn after
 * the bandana and an open mouth always wins. Open mouths are red-brown 'j'.
 * The mouth is centred on head col 8, just under the nose (cols 7-8).
 */
const MOUTH_ART = {
  grin: ['......k...k.....', '.......kkk......'], // the smirk
  chew0: ['..h....kk....h..'], // cheeks puffed
  chew1: ['..h.....kk...h..', '.......k........'],
  open: ['......kWjjk.....', '......kjjjk.....', '.......kkk......'],
  burp: ['.......kjk......', '......kjjjk.....', '.......kkk......'],
  tongue: ['......kkkkk.....', '.......kppk.....', '.......kppk.....', '........kk......'],
  flat: ['......kkkkk.....'],
  grit: ['.....kkkkkkk....', '.....kWkWkWk....', '......kkkkk.....'],
  gasp: ['.......kjk......', '.......kkk......'],
  smile: ['.....k....k.....', '......kkkk......'],
  bleh: ['......kjjjk.....', '......kjppk.....', '.......kppk.....', '........kk......'],
  sneeze: ['.....kkkkkkk....', '.....k.....k....'],
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
  /** The can lid worn as a bowler hat between the ears. */
  helmet?: boolean
  /** Ears folded flat and out: sad, hungry. */
  droop?: boolean
}

export function head(g: Grid, hx: number, hy: number, eyes: Eyes, mouth: Mouth, opts: HeadOpts = {}) {
  const rows = HEAD.map(r => r.split(''))
  const extra: Px = []
  const put = (x: number, y: number, c: string) => {
    if (x >= 0 && x < HEAD_W && y >= 0 && y < HEAD_H) rows[y]![x] = c
    else extra.push([x, y, c])
  }
  const ea: EyeArt = EYE_ART[eyes]
  ea.L.forEach((row, i) => [...row].forEach((c, x) => c !== '.' && put(2 + x, ea.r + i, c)))
  ;(ea.R ?? ea.L).forEach((row, i) => [...row].forEach((c, x) => c !== '.' && put(10 + x, ea.r + i, c)))
  if (opts.brow) for (const [x, y, c] of BROWS[opts.brow] as Px) put(x, y, c), put(15 - x, y, c)
  MOUTH_ART[mouth].forEach((row, i) => [...row].forEach((c, x) => c !== '.' && put(x, 10 + i, c)))
  if (opts.ear && !opts.droop) {
    // right ear flicks: the tip kicks out 1 px for a beat (reads at 1x)
    for (const [x, y, c] of [[13, 0, '.'], [14, 0, 'k'], [15, 0, 'k'], [12, 1, 'k'], [13, 1, 'k'], [14, 1, 'd'], [15, 1, 'g'], [16, 1, 'k'], [16, 2, 'k']] as Px) put(x, y, c)
    rows[0]![13] = '.'
  }
  if (opts.droop) {
    // ears folded flat and out to the sides
    rows[0] = [...'................']
    rows[1] = [...'................']
    rows[2] = [...'.kkkkkkkkkkkkkk.']
    rows[3]![0] = 'g'
    rows[3]![15] = 'g'
    for (const [x, y, c] of [[-1, 3, 'g'], [-1, 4, 'd'], [-2, 4, 'g'], [-2, 5, 'g'], [-3, 5, 'g'], [-3, 6, 'g']] as Px) extra.push([x, y, c], [15 - x, y, c])
    // the ear flick on a drooped ear: the right one lifts for a beat
    if (opts.ear) extra.push([16, 2, 'g'], [17, 2, 'g'], [18, 3, 'g'], [18, 6, '.'])
  }
  // cheek tufts: fluff sticks out past each jaw so the face reads fuzzy, not bony
  for (const y of [8, 9]) extra.push([-1, y, 'h'], [16, y, 'h'])
  const lean = (x: number) => (opts.tilt ? (opts.tilt > 0 ? (x >= 8 ? 1 : 0) : x <= 7 ? 1 : 0) : 0)
  rows.forEach((row, y) => row.forEach((c, x) => c !== '.' && g.set(hx + x, hy + y + lean(x), c)))
  for (const [x, y, c] of extra) if (c !== '.') g.set(hx + x, hy + y + lean(x), c)
  if (opts.helmet) g.stamp(hx + 3, hy + lean(8), HELMET)
}

/** The can lid worn as a bowler hat: knob, dome, brim, sitting between the ears. */
const HELMET = ['....qT....', '.qqqqqqqq.', 'TqqqqqqqqT']

/** Neckerchief: a band under the chin plus a triangle that hangs over the chest. */
export function bandana(g: Grid, cx: number, y: number, w: number, drop: number) {
  const x0 = Math.round(cx - w / 2)
  for (let x = 0; x < w; x++) g.set(x0 + x, y, 'r')
  for (let i = 1; i <= drop; i++) {
    const ww = Math.max(2, w - 4 - 2 * (i - 1) - (i > 1 ? 2 : 0))
    const xs = Math.round(cx - ww / 2)
    for (let x = 0; x < ww; x++) g.set(xs + x, y + i, x === ww - 1 ? 'R' : 'r')
  }
  // knot tails flicking out to the right
  g.set(x0 + w, y, 'r')
  g.set(x0 + w + 1, y - 1, 'R')
}

// ---- tail: ringed, 3 px thick, dark tip ---------------------------------

/** Rises behind his right side: base bottom-left (hidden by the body), tip top-right. */
const TAIL_UP = ['....mmm', '....ggg', '...mmm.', '...ggg.', '..mmm..', '..ggg..', '.mmm...', '.ggg...', 'mmm....']
/** Lying flat on the floor (asleep, coma). */
const TAIL_FLAT = ['.......mm', 'gggmmmggm', 'gggmmmgg.']
export const TAILS = { TAIL_UP, TAIL_FLAT }

/**
 * Stamp a tail. `swish` shears it: the base stays planted and the tip swings
 * (1 = tip leans in over the back, 2 = tip flicks out).
 */
export function tail(g: Grid, x: number, y: number, art: readonly string[], swish: 0 | 1 | 2 = 0) {
  const n = art.length
  const amp = swish === 1 ? -2 : swish === 2 ? 2 : 0
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
  g.set(x + 1, y + 1, core === 'w' ? 'W' : core)
}

/** The golden pellet: bigger, gold, white-hot core. */
export function goldPellet(g: Grid, x: number, y: number) {
  g.stamp(x, y, ['.Y.', 'YWY', '.Y.'])
  g.set(x + 1, y - 1, 'y')
  g.set(x - 1, y + 1, 'y')
  g.set(x + 3, y + 1, 'y')
  g.set(x + 1, y + 3, 'y')
}

/** Floor slots, nearest the can first (the fattest bodies leave the least floor). */
export const SLOTS: Array<[number, number]> = [
  [11, 17], [13, 14], [15, 17], [19, 17], [17, 14], [15, 11], [23, 17], [21, 14], [19, 11],
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

/** A front-facing foot: dark, toes forward. */
const FOOT_L = ['.dd.', 'dddd']
const FOOT_S = ['ddd']
export function foot(g: Grid, x: number, y: number, big = true) {
  g.stamp(x, y, big ? FOOT_L : FOOT_S)
}

// ---- anchors (shared by idle, poke, intro and events) ------------------

/** Head left edge; the body is centred under the head at CX. */
export const HEAD_X = 21
export const CX = HEAD_X + 7.5
export const HEAD_POS: Record<StateId, Pellet> = {
  asleep: { x: HEAD_X, y: 2 },
  skinny: { x: HEAD_X, y: 1 },
  snacking: { x: HEAD_X, y: 0 },
  round: { x: HEAD_X, y: 0 },
  huge: { x: HEAD_X, y: 0 },
  bloated: { x: HEAD_X, y: 0 },
  coma: { x: HEAD_X, y: 3 },
  workout: { x: HEAD_X, y: 1 },
}
/**
 * Where a pellet ends up (its centre): held in both paws at the mouth, the
 * top of the pellet touching the lips. Head x + 8, head y + 12.
 */
export const MOUTH: Record<StateId, Pellet> = Object.fromEntries(
  Object.entries(HEAD_POS).map(([s, p]) => [s, { x: p.x + 8, y: p.y + 12 }]),
) as Record<StateId, Pellet>

/** Body radii per state: the belly width IS the meter. */
type Spec = { rx: number; ry: number }
export const BODY: Record<StateId, Spec> = {
  asleep: { rx: 4, ry: 4.4 },
  skinny: { rx: 4, ry: 4.4 },
  snacking: { rx: 5.5, ry: 4.8 },
  round: { rx: 7, ry: 5.2 },
  huge: { rx: 9, ry: 5.8 },
  bloated: { rx: 11.5, ry: 6.6 },
  coma: { rx: 11, ry: 5 },
  workout: { rx: 4, ry: 4.4 },
}
const thinBody = (s: StateId) => s === 'skinny' || s === 'asleep' || s === 'workout'

/** Free arms: where each shoulder starts, per body (L = screen-left, toward the can). */
export const SHOULDER_L: Record<StateId, Pellet> = Object.fromEntries(
  (Object.keys(BODY) as StateId[]).map(s => [s, { x: Math.round(CX - BODY[s].rx + (thinBody(s) ? 0 : 1)), y: HEAD_POS[s].y + 13 }]),
) as Record<StateId, Pellet>
export const SHOULDER_R: Record<StateId, Pellet> = Object.fromEntries(
  (Object.keys(BODY) as StateId[]).map(s => [s, { x: Math.round(CX + BODY[s].rx - (thinBody(s) ? 0 : 2)), y: HEAD_POS[s].y + 13 }]),
) as Record<StateId, Pellet>

/**
 * Arm from a shoulder to a paw (2 px, 1 px on the thin bodies). Over the body
 * it is dark fur so it reads against the belly; out in the air it is fur
 * colour and picks up the auto outline. The paw is dark.
 */
export function arm(g: Grid, state: StateId, from: Pellet, paw: Pellet, outlined = true, withPaw = true) {
  const thin = thinBody(state)
  const size = thin ? 1 : 2
  const n = Math.max(Math.abs(paw.x - from.x), Math.abs(paw.y - from.y), 1)
  for (let i = 0; i <= n; i++) {
    const x = Math.round(from.x + ((paw.x - from.x) * i) / n)
    const y = Math.round(from.y + ((paw.y - from.y) * i) / n)
    for (let dy = 0; dy < size; dy++)
      for (let dx = 0; dx < size; dx++) {
        const X = x + dx + g.ox
        const Y = y + dy + g.oy
        const under = g.get(X, Y)
        g.set(x + dx, y + dy, under === '.' || under === 'k' ? (outlined ? 'g' : 'd') : 'd')
      }
  }
  if (!withPaw) return
  if (thin) g.rect(paw.x, paw.y, paw.x + 1, paw.y, 'd')
  else g.rect(paw.x, paw.y, paw.x + 1, paw.y + 1, 'd')
}

/** A bent arm: shoulder to elbow, elbow to paw (reads as a limb, not a stick, on long reaches). */
export function bentArm(g: Grid, state: StateId, from: Pellet, elbow: Pellet, paw: Pellet) {
  arm(g, state, from, elbow, true, false)
  arm(g, state, elbow, paw)
}

/** A resting arm down one flank, forearm curling in, paw on the belly. */
export function restArm(g: Grid, state: StateId, s: -1 | 1, hy = HEAD_POS[state].y, rx = BODY[state].rx) {
  const thin = thinBody(state)
  const x = Math.round(CX + s * (rx - (thin ? 0.3 : 1.2))) - (s > 0 && !thin ? 1 : 0)
  const y0 = hy + 13
  if (thin) {
    g.line(x, y0, x, y0 + 4, 1, 'd')
    return
  }
  g.rect(x, y0, x + 1, y0 + 2, 'd')
  g.rect(s < 0 ? x + 1 : x - 1, y0 + 3, s < 0 ? x + 2 : x, y0 + 3, 'd')
}

/** Both paws up under the chin, holding (or about to hold) a pellet at the mouth. */
export function holdPaws(g: Grid, state: StateId, dx = 0, dy = 0) {
  const M = MOUTH[state]
  const thin = thinBody(state)
  const rx = BODY[state].rx
  for (const s of [-1, 1]) {
    const from = { x: Math.round(CX + s * (rx - (thin ? 0.5 : 1.5))) - (s > 0 && !thin ? 1 : 0), y: M.y + 3 + dy }
    const paw = { x: s < 0 ? M.x - 3 + dx : M.x + 2 + dx, y: M.y + dy }
    if (thin) {
      g.line(from.x, from.y, paw.x + (s < 0 ? 1 : 0), paw.y, 1, 'd')
      g.rect(paw.x, paw.y, paw.x + 1, paw.y, 'd')
    } else {
      g.line(from.x, from.y, paw.x, paw.y, 2, 'd')
      g.rect(paw.x, paw.y, paw.x + 1, paw.y + 1, 'd')
    }
  }
}

// ---- bodies ------------------------------------------------------------

export type BodyOpts = {
  /** Base pose within the state's idle loop (old frame index). */
  pose?: number
  eyes?: Eyes
  mouth?: Mouth
  brow?: Brow
  /**
   * 'pose' draws the state's own arms; 'none' leaves both free for props;
   * 'right' keeps only the resting right arm; 'hold' brings both paws up to
   * the mouth (eating).
   */
  arms?: 'pose' | 'none' | 'right' | 'hold'
  blink?: boolean
  ear?: boolean
  tail?: 0 | 1 | 2
  jiggle?: number
  headDx?: number
  headDy?: number
  tilt?: -1 | 0 | 1
  helmet?: boolean
  bandana?: boolean
  /** Tuck the bandana's triangle away (paws busy at the chest). */
  tuck?: boolean
  /** Whole-body offset (waddling in the intro). */
  dx?: number
  dy?: number
}

/** Squash/stretch of the belly after a burst lands: [rx, ry, cy, head drop]. */
const JIGGLE: Array<[number, number, number, number]> = [
  [1.4, -0.9, 0.5, 1],
  [-0.9, 0.5, -0.3, 0],
  [0.8, -0.4, 0.2, 0],
  [0.3, -0.1, 0, 0],
]
export const JIGGLE_FRAMES = JIGGLE.length
function jig(o: BodyOpts): [number, number, number, number] {
  return o.jiggle === undefined ? [0, 0, 0, 0] : JIGGLE[((o.jiggle % JIGGLE.length) + JIGGLE.length) % JIGGLE.length]!
}

function face(o: BodyOpts, eyes: Eyes, mouth: Mouth, brow?: Brow): [Eyes, Mouth, Brow | undefined] {
  const e = o.eyes ?? eyes
  return [o.blink && e !== 'closed' ? 'closed' : e, o.mouth ?? mouth, o.blink ? undefined : (o.brow ?? brow)]
}

/** The idle look of each awake body, per pose. */
function idleFace(state: StateId, f: number): [Eyes, Mouth, Brow | undefined] {
  switch (state) {
    case 'skinny':
      return f === 1 ? ['wide', 'tongue', 'hungry'] : f === 2 ? ['left', 'flat', 'hungry'] : ['wide', 'flat', 'hungry']
    case 'snacking':
      return f === 0 ? ['left', 'grin', undefined] : f === 1 ? ['happy', 'open', undefined] : ['happy', f === 2 ? 'chew0' : 'chew1', undefined]
    case 'round':
      return ['happy', f === 1 ? 'open' : f === 0 ? 'chew0' : 'chew1', undefined]
    case 'huge':
      return ['lidded', f % 4 < 2 ? 'chew0' : 'chew1', undefined]
    case 'bloated':
      return ['lidded', f >= 2 ? 'burp' : 'flat', f >= 2 ? undefined : 'bored']
    default:
      return ['normal', 'grin', undefined]
  }
}

/** The bit of floor shadow under a jump. */
function shadow(g: Grid, cx: number, w: number) {
  g.rect(Math.round(cx - w), 19, Math.round(cx + w), 19, 'T')
}

/**
 * Every sitting body: tail, round belly, feet, arms, bandana, head. The body
 * is an ellipse sitting on the floor whose width grows with the state.
 */
function sitter(g: Grid, state: StateId, o: BodyOpts) {
  const f = o.pose ?? 0
  const [jrx, jry, jcy, jdrop] = jig(o)
  const spec = BODY[state]
  const thin = thinBody(state)
  const breath = state === 'bloated' && f === 1 ? 0.7 : 0
  const rx = spec.rx + jrx + breath
  const ry = spec.ry + jry + breath * 0.3
  const cx = CX
  const cy = 19.6 - ry + jcy
  const hp = HEAD_POS[state]
  const hy = hp.y + (o.headDy ?? 0) + jdrop
  const hx = hp.x + (o.headDx ?? 0)
  g.ox = o.dx ?? 0
  g.oy = o.dy ?? 0

  // tail behind the right hip: the tip clears the head
  const tx = Math.round(cx + spec.rx) - 2
  tail(g, thin ? tx + 1 : tx, thin ? 11 : state === 'snacking' ? 10 : 9, TAIL_UP, o.tail ?? 0)

  // belly
  g.ellipse(cx, cy, rx, ry, 'g')
  g.ellipse(cx, cy + ry * 0.3, rx * 0.66, ry * 0.72, 'h')
  if (!thin) g.set(Math.round(cx) - 1, Math.round(cy + ry * 0.35), 'd') // belly button
  if (state === 'huge') belt(g, cx, cy, rx, ry)
  if (state === 'bloated') {
    // the belt gave up: frayed ends hang off each hip, the buckle is on the floor
    for (const s of [-1, 1]) {
      const x = Math.round(cx + s * (rx - 0.5))
      g.set(x, 15, 'n'), g.set(x + s, 15, 'n'), g.set(x + s, 16, 'n')
    }
    g.stamp(Math.round(cx + rx) + 1, 18, ['YY', 'Yn'])
  }

  // feet
  if (thin) {
    // stick legs to small feet
    for (const s of [-1, 1]) {
      const x = Math.round(cx + s * 1.5 - 0.5)
      g.set(x, 18, 'g')
      g.rect(x + (s < 0 ? -1 : 0), 19, x + (s < 0 ? 0 : 1), 19, 'd')
    }
  } else {
    const spread = rx * 0.62
    foot(g, Math.round(cx - spread) - 2, 18)
    foot(g, Math.round(cx + spread) - 1, 18)
  }

  // resting arms: down the sides, paws on the belly
  const arms = o.arms ?? 'pose'
  const restL = arms === 'pose' && !(state === 'snacking' && f <= 1) && !(state === 'round')
  const restR = (arms === 'pose' || arms === 'right') && !(state === 'snacking' && f === 1) && !(state === 'round' && arms === 'pose')
  if (restL) restArm(g, state, -1, hy, rx)
  if (restR) restArm(g, state, 1, hy, rx)

  // neckerchief, then the head over it; with paws up at the chin the knot's
  // triangle is tucked away so paws and pellet sit on the light belly, not on red
  const holding = arms === 'hold' || (arms === 'pose' && (state === 'round' || (state === 'snacking' && f === 1)))
  if (o.bandana !== false) bandana(g, hx + 8, hy + 12, thin ? 10 : 12, holding || o.tuck ? 1 : 3)
  const [eyes, mouth, brow] = face(o, ...idleFace(state, f))
  head(g, hx, hy, eyes, mouth, { brow, ear: o.ear, tilt: o.tilt, helmet: o.helmet })

  // arms that come up in front of the chest
  if (holding) holdPaws(g, state, 0, jdrop)
  if (arms === 'pose' && state === 'snacking' && f === 0) {
    // grabbing a pellet off the pile
    arm(g, state, SHOULDER_L[state], { x: 19, y: 16 })
  }
  if (arms === 'pose' && state === 'round' && f !== 2 && f !== 1) pellet(g, MOUTH.round.x - 1, MOUTH.round.y - 1 + jdrop, 'w')
  if (arms === 'pose' && state === 'round' && f === 1) g.set(MOUTH.round.x, MOUTH.round.y + jdrop, 'o')
  if (arms === 'pose' && state === 'snacking' && f === 1) pellet(g, MOUTH.snacking.x - 1, MOUTH.snacking.y - 1, 'w')
  g.ox = 0
  g.oy = 0
}

/** The straining belt across a huge belly: brown band, gold buckle, stress creases. */
function belt(g: Grid, cx: number, cy: number, rx: number, ry: number) {
  for (const y of [16, 17])
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx
      const dy = (y - cy) / ry
      if (dx * dx + dy * dy <= 1) g.set(x, y, 'n')
    }
  g.rect(Math.round(cx) - 2, 15, Math.round(cx) + 1, 18, 'Y')
  g.rect(Math.round(cx) - 1, 16, Math.round(cx), 17, 'n')
  // belly bulging over the belt
  for (const s of [-1, 1]) g.set(Math.round(cx + s * rx * 0.55) - (s < 0 ? 1 : 0), 15, 'd')
}

/** The huge sweat drip: forms at the left temple, rolls down, drops, splats on the shoulder. */
export const DRIP_STEPS = 8
export function drip(g: Grid, step: number) {
  const s = ((step % DRIP_STEPS) + DRIP_STEPS) % DRIP_STEPS
  const x = HEAD_X - 1
  if (s === 0) g.set(x, 3, 'a')
  else if (s === 1) g.set(x, 3, 's'), g.set(x, 4, 'a')
  else if (s === 2) g.set(x, 5, 's'), g.set(x, 6, 'a')
  else if (s === 3) g.set(x - 1, 7, 's'), g.set(x - 1, 8, 'a')
  else if (s === 4) g.set(x - 1, 10, 's'), g.set(x - 1, 11, 'a')
  else if (s === 5) g.set(x - 2, 12, 's'), g.set(x, 12, 's'), g.set(x - 1, 11, 'a')
  // 6, 7: dry beat before the next bead
}

const PUFF_S = ['.cc.', 'cccc', '.cc.']
const PUFF_L = ['..ccc.', '.ccccc', 'cccccc', '.cccc.']
export function burpPuff(g: Grid, f: number) {
  if (f === 2) {
    g.stamp(16, 8, PUFF_S)
    g.set(14, 6, 'c')
  } else if (f === 3) {
    g.stamp(14, 7, PUFF_L)
    g.stamp(10, 3, PUFF_S)
    g.set(8, 1, 'c')
  }
}

/** Asleep (no data yet): skinny, slumped, head lolling, eyes shut. */
function asleep(g: Grid, o: BodyOpts) {
  sitter(g, 'asleep', { ...o, eyes: 'closed', mouth: o.mouth ?? 'flat', brow: undefined, tilt: 1, blink: false })
}

/**
 * Food coma: flopped beside the drained can, legs splayed soles-out, arms
 * limp on the floor, head slumped and tilted, x-eyes, tongue out, belly breathing.
 */
function coma(g: Grid, o: BodyOpts) {
  const f = o.pose ?? 0
  const b = f % 2 ? 0.5 : 0
  const cx = CX
  const hp = HEAD_POS.coma
  tail(g, cx + 8, 16, TAIL_FLAT)
  g.ellipse(cx, 19.8 - BODY.coma.ry - b * 0.5, BODY.coma.rx + b, BODY.coma.ry + b * 0.5, 'g')
  g.ellipse(cx, 17.4, 7 + b, 3.6, 'h')
  g.set(Math.round(cx) - 1, 17, 'd')
  // limp arms flopped out on the floor
  for (const s of [-1, 1]) {
    const x0 = Math.round(cx + s * (BODY.coma.rx - 1))
    g.line(x0, 15, x0 + s * 3, 18, 2, 'g')
    g.rect(x0 + s * 3 + (s < 0 ? -1 : 0), 18, x0 + s * 3 + (s < 0 ? 0 : 1), 19, 'd')
  }
  // splayed feet, soles out
  foot(g, Math.round(cx) - 7, 18)
  foot(g, Math.round(cx) + 4, 18)
  bandana(g, hp.x + 8, hp.y + 12, 12, 2)
  head(g, hp.x, hp.y, 'closed', 'tongue', { ear: o.ear, tilt: 1 })
}

/** Workout: skinny jumping jacks. Pose 1 = arms up, legs out, airborne. */
function workout(g: Grid, o: BodyOpts) {
  const up = (o.pose ?? 0) === 1
  const cx = CX
  const lift = up ? 1 : 0
  const hp = HEAD_POS.workout
  const hy = hp.y - lift
  tail(g, Math.round(cx + 4) - 1, 11 - lift, TAIL_UP, up ? 2 : 0)
  g.ellipse(cx, 15.2 - lift, 4, 4.2, 'g')
  g.ellipse(cx, 16.4 - lift, 2.6, 3, 'h')
  if (up) {
    // legs kicked out, feet off the floor, a shadow underneath
    g.line(cx - 2, 18 - lift, cx - 5, 18, 1, 'g')
    g.line(cx + 2, 18 - lift, cx + 5, 18, 1, 'g')
    g.rect(Math.round(cx - 7), 18, Math.round(cx - 6), 18, 'd')
    g.rect(Math.round(cx + 5), 18, Math.round(cx + 6), 18, 'd')
    shadow(g, cx, 6)
    // arms straight up beside the ears (behind the head)
    g.line(cx - 4, 13 - lift, HEAD_X - 2, 2, 1, 'g')
    g.line(cx + 4, 13 - lift, HEAD_X + 17, 2, 1, 'g')
    g.rect(HEAD_X - 3, 1, HEAD_X - 2, 1, 'd')
    g.rect(HEAD_X + 17, 1, HEAD_X + 18, 1, 'd')
  } else {
    for (const s of [-1, 1]) {
      const x = Math.round(cx + s * 1.5 - 0.5)
      g.set(x, 18, 'g')
      g.rect(x + (s < 0 ? -1 : 0), 19, x + (s < 0 ? 0 : 1), 19, 'd')
    }
    // arms down at the sides
    for (const s of [-1, 1]) {
      const x = Math.round(cx + s * 4.3)
      g.line(x, 13, x + s, 17, 1, 'g')
      g.set(x + s, 18, 'd')
    }
  }
  bandana(g, hp.x + 8, hy + 12, 10, 3)
  const [eyes, mouth, brow] = face(o, up ? 'happy' : 'normal', up ? 'open' : 'grin', up ? undefined : 'raised')
  head(g, hp.x, hy, eyes, mouth, { brow })
}

/** Draw a body for any state. Workout: pose 1 = arms up. */
export function drawBody(g: Grid, state: StateId, o: BodyOpts = {}) {
  switch (state) {
    case 'asleep':
      return asleep(g, o)
    case 'coma':
      return coma(g, o)
    case 'workout':
      return workout(g, o)
    default:
      return sitter(g, state, o)
  }
}

/** Wobble ticks beside the belly on the squash beats of a jiggle. */
export function jiggleTicks(g: Grid, state: StateId, k: number) {
  if (k !== 0 && k !== 2) return
  if (state === 'coma' || state === 'workout') return
  const r = BODY[state].rx + (k === 0 ? 1.4 : 0.8)
  for (const s of [-1, 1]) {
    const x = Math.round(CX + s * (r + 1.5))
    g.set(x, 15, 'c'), g.set(x, 17, 'c')
    if (k === 0) g.set(x + s, 16, 'c')
  }
}

/**
 * Pellets on their way to the mouth. Whatever path the caller computed (a
 * stream from the can, a burst from above), each pellet is redrawn on Tonk's
 * own path: a hop out of the can, then a level slide in at mouth height into
 * his paws. Progress is how close the pellet already is to the mouth, so the
 * timing is the caller's and nothing ever crosses the face above the nose.
 */
export function incoming(g: Grid, state: StateId, from: Pellet, pellets: readonly Pellet[]) {
  const B = MOUTH[state]
  const A = { x: from.x + 1, y: from.y + 1 }
  const K = { x: HEAD_POS[state].x - 3, y: B.y }
  const hop = Math.hypot(K.x - A.x, K.y - A.y)
  const slide = B.x - K.x
  const D = Math.max(hop + slide, Math.hypot(B.x - A.x, B.y - A.y)) * 0.9
  for (const p of pellets) {
    const d = Math.hypot(p.x + 1 - B.x, p.y + 1 - B.y)
    const t = Math.max(0, Math.min(1, 1 - d / D))
    const s = t * (hop + slide)
    let x: number
    let y: number
    if (s < hop) {
      const u = s / hop
      x = A.x + (K.x - A.x) * u
      y = A.y + (K.y - A.y) * u - 6 * Math.sin(Math.PI * u)
    } else {
      x = K.x + (s - hop)
      y = B.y
    }
    pellet(g, Math.round(x) - 1, Math.round(y) - 1, 'w')
  }
}

/** Pellets that land while he sleeps: they rain down on the can side and bounce onto the pile. */
export function rainOnPile(g: Grid, pellets: readonly Pellet[]) {
  pellets.forEach((p, i) => {
    const x = 12 + ((i * 5) % 8)
    const y = Math.max(-2, Math.min(16, p.y))
    pellet(g, x, y, 'w')
  })
}
