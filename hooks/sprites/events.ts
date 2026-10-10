// Random delight events: short one-shot bits Tonk does while idle. Each is a
// frame list played uniformly over `ms` (render.ts picks the frame from the
// event's progress). Choreography is written once against anchors (mouth,
// head, shoulders), so every awake body plays it at its own size.
//
// Front view rule: the big head owns the top-middle of the band, so props
// live in the free air LEFT of the head (x <= head - 2) or RIGHT of it
// (x >= head + 17). Nothing is drawn over the eyes or the mask; paws and
// pellets only ever come up to the chin.

import type { Pellet, StateId } from '../core.ts'
import {
  Grid, HEAD_POS, LID, LID_TILT, MOUTH, PILE, SHOULDER_L, SHOULDER_R,
  arm, bang, bentArm, can, drawBody, goldPellet, pellet, pile, query, restArm, star, zed,
  type BodyOpts,
} from './base.ts'

export const EVENT_NAMES = ['wash', 'treasure', 'lid_hat', 'juggle', 'sneeze', 'look_up', 'golden', 'doze', 'bandana_cape'] as const
export type EventName = (typeof EVENT_NAMES)[number]

/** frames: drawn poses; ms: intended length (matches core EVENT_MS). Frames are uniform over ms. */
export const EVENTS: Record<EventName, { frames: number; ms: number }> = {
  wash: { frames: 12, ms: 3000 },
  treasure: { frames: 10, ms: 2500 },
  lid_hat: { frames: 12, ms: 3000 },
  juggle: { frames: 24, ms: 3000 },
  sneeze: { frames: 12, ms: 1500 },
  look_up: { frames: 8, ms: 2000 },
  golden: { frames: 10, ms: 2500 },
  doze: { frames: 16, ms: 4000 },
  bandana_cape: { frames: 12, ms: 3000 },
}

type Post = (g: Grid) => void
type Ctx = {
  g: Grid
  s: StateId
  M: Pellet
  hp: Pellet
  L: Pellet
  R: Pellet
  /** Free air left of the head (x) and right of it (x). */
  lx: number
  rx: number
  posts: Post[]
}

const add = (p: Pellet, dx: number, dy: number): Pellet => ({ x: p.x + dx, y: p.y + dy })

function body(c: Ctx, o: BodyOpts) {
  drawBody(c.g, c.s, { pose: 2, arms: 'none', ...o })
}
function armL(c: Ctx, paw: Pellet) {
  arm(c.g, c.s, c.L, paw)
}
function armR(c: Ctx, paw: Pellet) {
  arm(c.g, c.s, c.R, paw)
}
function restL(c: Ctx, dy = 0) {
  restArm(c.g, c.s, -1, c.hp.y + dy)
}
function restR(c: Ctx, dy = 0) {
  restArm(c.g, c.s, 1, c.hp.y + dy)
}
function post(c: Ctx, f: Post) {
  c.posts.push(f)
}

/** A gold bottle cap with a crimped edge and a glint. */
const CAP = ['.YY.', 'YWYY', 'OYOY']

// ---- the events --------------------------------------------------------

function wash(c: Ctx, k: number) {
  const { M, lx } = c
  const puddle = (g: Grid, splash: number) => {
    for (let x = 13; x <= 20; x++) g.set(x, 19, x === 15 || x === 18 ? 'a' : 's')
    for (let x = 14; x <= 19; x++) g.set(x, 18, x === 16 ? 'a' : 's')
    if (splash === 1) for (const [x, y] of [[13, 16], [20, 15], [17, 15], [15, 16]] as Array<[number, number]>) g.set(x, y, 'a')
    if (splash === 2) for (const [x, y] of [[12, 15], [21, 14], [17, 13], [14, 14], [19, 16], [16, 15]] as Array<[number, number]>) g.set(x, y, 's')
  }
  if (k === 0) {
    // a grubby pellet held up to inspect, off to the side
    body(c, { eyes: 'left', mouth: 'flat', brow: 'raised' })
    armL(c, { x: lx, y: M.y - 3 })
    restR(c)
    post(c, g => (puddle(g, 0), pellet(g, lx - 2, M.y - 6, 'o')))
  } else if (k <= 3) {
    // dunk it in the puddle
    body(c, { eyes: k === 1 ? 'left' : 'squint', mouth: 'flat' })
    armL(c, { x: 17, y: k === 1 ? 15 : 17 })
    restR(c)
    post(c, g => puddle(g, k - 1))
  } else if (k <= 7) {
    // the scrub: paws rub up and down against each other at the chest, drops fly
    const up = k % 2 === 0
    body(c, { eyes: 'lidded', mouth: k === 5 ? 'smile' : 'flat', tuck: true })
    const L = { x: M.x - 3, y: M.y + (up ? 0 : 1) }
    const R = { x: M.x + 2, y: M.y + (up ? 1 : 0) }
    arm(c.g, c.s, c.L, L, false)
    arm(c.g, c.s, c.R, R, false)
    post(c, g => {
      puddle(g, 0)
      g.set(M.x, M.y + 1, k % 2 ? 'y' : 'W'), g.set(M.x - 1, M.y + 1, 'o'), g.set(M.x + 1, M.y + 1, 'o')
      const drops: Array<[number, number]> = up ? [[-6, 0], [6, -1], [-5, 4], [5, 3]] : [[-7, 2], [7, 1], [-4, 5], [6, 4]]
      for (const [dx, dy] of drops) g.set(M.x + dx, M.y + dy, k % 2 ? 's' : 'a')
      for (const [dx, dy] of up ? [[-2, 3], [2, 2]] : [[-1, 2], [3, 3]]) g.set(M.x + dx!, M.y + dy!, 'W')
    })
  } else if (k === 8) {
    // squeaky clean: held up high, sparkling
    body(c, { eyes: 'wide', mouth: 'grin', brow: 'raised' })
    armL(c, { x: lx, y: M.y - 5 })
    restR(c)
    post(c, g => (puddle(g, 0), pellet(g, lx - 2, M.y - 8, 'w'), star(g, lx - 4, M.y - 9)))
  } else if (k === 9) {
    body(c, { eyes: 'happy', mouth: 'open', arms: 'hold' })
    post(c, g => (puddle(g, 0), pellet(g, M.x - 1, M.y - 1, 'w')))
  } else {
    body(c, { eyes: 'happy', mouth: k === 10 ? 'chew0' : 'chew1' })
    restL(c)
    restR(c)
    post(c, g => puddle(g, 0))
  }
}

function treasure(c: Ctx, k: number) {
  const { M, hp, lx } = c
  const capAt = (g: Grid, p: Pellet) => g.stamp(p.x, p.y, CAP)
  if (k > 2) can(c.g)
  if (k <= 2) {
    // rummaging: arm deep in the can, the can rocking
    const jolt = k === 1 ? -1 : k === 2 ? 1 : 0
    can(c.g, { dx: jolt })
    // he shuffles right up to the can and digs in, elbow high
    const lean = -5
    body(c, { eyes: k === 0 ? 'left' : 'squint', mouth: 'flat', brow: k === 0 ? 'raised' : 'annoyed', tail: k === 1 ? 1 : 0, dx: lean })
    bentArm(c.g, c.s, add(c.L, lean, 0), { x: c.L.x + lean - 4, y: c.L.y - 4 }, { x: 10 + jolt, y: 12 + (k % 2) })
    c.g.ox = lean
    restR(c)
    c.g.ox = 0
    if (k > 0)
      post(c, g => {
        for (const [x, y] of [[1, 8], [3, 7], [12, 10], [13, 12]] as Array<[number, number]>) g.set(x + jolt, y, 'c')
      })
  } else if (k === 3) {
    body(c, { eyes: 'wide', mouth: 'gasp', brow: 'raised' })
    armL(c, { x: lx, y: M.y - 3 })
    restR(c)
    post(c, g => (capAt(g, { x: lx - 3, y: M.y - 6 }), star(g, lx - 4, M.y - 8)))
  } else if (k <= 6) {
    // held up to the light: sparkle eyes, twinkles in the free air beside the head
    body(c, { eyes: 'sparkle', mouth: k === 5 ? 'grin' : 'gasp' })
    armL(c, { x: lx, y: hp.y + 6 })
    restR(c)
    const twinkles: Array<Array<[number, number, boolean]>> = [
      [[lx - 6, 2, true], [lx + 1, 9, false]],
      [[lx - 1, 1, false], [lx - 7, 7, true]],
      [[lx - 5, 1, true], [lx + 1, 4, false], [lx - 7, 6, false]],
    ]
    post(c, g => {
      capAt(g, { x: lx - 3, y: hp.y + 3 })
      for (const [x, y, big] of twinkles[k - 4]!) star(g, x, y, big)
    })
  } else {
    // tucked into the bandana knot for good: 2x2, bright, with a shine
    const capX = hp.x + 7
    const capY = hp.y + 13
    body(c, { eyes: 'happy', mouth: 'smile' })
    if (k === 7) armL(c, { x: capX - 2, y: capY + 1 })
    else restL(c)
    if (k === 8) armR(c, { x: capX + 2, y: capY + 1 })
    else restR(c)
    post(c, g => {
      g.stamp(capX, capY, ['WY', 'YO'])
      if (k >= 8) star(g, c.rx + 1, hp.y + 3, k === 9, 'W')
    })
  }
}

function lidHat(c: Ctx, k: number) {
  const { hp, lx, R } = c
  const lidOnCan = k === 0 || k === 11
  can(c.g, { lid: lidOnCan })
  const helmet = k >= 3 && k <= 9
  const salute = k >= 5 && k <= 8
  body(c, {
    helmet,
    eyes: k === 0 ? 'left' : k === 3 ? 'closed' : k === 10 || k === 11 ? 'happy' : 'normal',
    mouth: salute ? (k >= 7 ? 'grin' : 'flat') : 'grin',
    brow: (salute && k < 7) || k === 0 ? (k === 0 ? 'raised' : 'annoyed') : undefined,
    headDy: k === 3 ? 1 : 0,
  })
  if (k === 0) {
    restL(c)
    restR(c)
  } else if (k === 1) {
    bentArm(c.g, c.s, c.L, { x: lx + 1, y: c.L.y }, { x: lx, y: 6 })
    restR(c)
    c.g.stamp(lx - 7, 3, LID)
  } else if (k === 2) {
    armL(c, { x: lx + 1, y: hp.y + 3 })
    restR(c)
    c.g.stamp(hp.x - 2, hp.y, LID_TILT)
  } else if (k === 3 || k === 4) {
    armL(c, { x: lx + 1, y: hp.y + 4 })
    restR(c)
    if (k === 3)
      post(c, g => {
        for (const [x, y] of [[-3, 1], [-4, 3], [17, 1], [18, 3]] as Array<[number, number]>) g.set(hp.x + x, hp.y + y, 'c')
      })
  } else if (salute) {
    // paw snapped to the brim, elbow out past the cheek
    restL(c)
    arm(c.g, c.s, R, { x: c.rx + 1, y: hp.y + 8 })
    arm(c.g, c.s, { x: c.rx + 1, y: hp.y + 8 }, { x: c.rx - 1, y: hp.y + 2 })
    if (k >= 7) post(c, g => star(g, hp.x + 8, Math.max(1, hp.y - 1), k === 8))
  } else if (k === 9) {
    restL(c)
    restR(c)
  } else if (k === 10) {
    armL(c, { x: lx, y: hp.y + 4 })
    restR(c)
    c.g.stamp(5, 2, LID_TILT)
    post(c, g => {
      for (const [x, y] of [[13, 3], [14, 5], [12, 1]] as Array<[number, number]>) g.set(x, y, 'c')
    })
  } else {
    restL(c)
    restR(c)
    post(c, g => {
      for (const [x, y] of [[0, 6], [9, 6], [10, 8]] as Array<[number, number]>) g.set(x, y, 'c')
    })
  }
}

function juggle(c: Ctx, k: number) {
  const { hp, lx } = c
  // a two-pellet loop in the free air left of the head, one paw tossing
  const cx = lx - 1
  const bottom = hp.y + 8
  const top = 0
  const cy = (bottom + top) / 2
  const at = (u: number): Pellet => {
    const th = 2 * Math.PI * (((u % 1) + 1) % 1)
    return { x: cx + 2 * Math.sin(th), y: cy + ((bottom - top) / 2) * Math.cos(th) }
  }
  const paw = { x: cx + 1, y: bottom + 2 }
  if (k < 16) {
    const u = k / 8
    const balls = [0, 0.5].map(o => at(u + o))
    const dip = balls.some(b => b.y > bottom - 1.5) ? 1 : 0
    body(c, { eyes: k % 8 < 4 ? 'left' : 'up', mouth: k % 8 < 4 ? 'grin' : 'smile', brow: 'raised' })
    armL(c, add(paw, 0, dip))
    restR(c)
    post(c, g => balls.forEach(b => pellet(g, Math.round(b.x) - 1, Math.round(b.y) - 1, 'y')))
  } else if (k < 18) {
    // one goes way too high: one caught, the other sails up over the ears
    body(c, { eyes: 'up', mouth: 'gasp', brow: 'raised' })
    armL(c, add(paw, 0, -1))
    restR(c)
    post(c, g => {
      pellet(g, paw.x, paw.y - 3, 'y')
      pellet(g, k === 16 ? lx + 1 : hp.x + 4, -1, 'w')
    })
  } else if (k < 20) {
    // BONK, right on the crown
    const bonk = k === 19
    body(c, { eyes: bonk ? 'dizzy' : 'up', mouth: bonk ? 'flat' : 'gasp', headDy: bonk ? 1 : 0, ear: bonk })
    armL(c, add(paw, 0, 1))
    restR(c)
    post(c, g => {
      pellet(g, paw.x, paw.y - 2, 'y')
      pellet(g, hp.x + 6, bonk ? 0 : -1, 'w')
      if (bonk) for (const [x, y] of [[3, 1], [12, 1], [2, 3], [13, 3]] as Array<[number, number]>) g.set(hp.x + x, hp.y + y, 'c')
    })
  } else {
    // dizzy stars circle the head, then a sheepish grin; the stray pellet rolls off
    const dizzy = k < 23
    body(c, { eyes: dizzy ? 'dizzy' : 'happy', mouth: dizzy ? 'flat' : 'grin', tilt: dizzy ? (k % 2 ? 1 : -1) : 0 })
    restL(c)
    restR(c)
    post(c, g => {
      if (dizzy) {
        const ring: Array<[number, number]> = [[lx, 2], [c.rx + 1, 2], [c.rx + 2, 6], [lx - 1, 6]]
        for (let i = 0; i < 2; i++) {
          const [x, y] = ring[(i * 2 + k) % ring.length]!
          star(g, x, y, false, i === 0 ? 'W' : 'Y')
        }
      }
      pellet(g, Math.max(10, lx - 3 - (k - 20) * 2), 16, 'y')
    })
  }
}

function sneeze(c: Ctx, k: number) {
  const { M, lx } = c
  // dust motes drifting in from the can side, toward the nose
  const dust = (g: Grid) => {
    for (const [x, y] of [[0, 8], [-2, 7], [-1, 10], [-3, 9]] as Array<[number, number]>) g.set(lx + x + (k % 2), y + c.hp.y, 'y')
  }
  if (k < 2) {
    body(c, { eyes: 'lidded', mouth: 'chew0', ear: k === 1 })
    restL(c)
    restR(c)
    post(c, dust)
  } else if (k < 4) {
    body(c, { eyes: k === 2 ? 'squint' : 'closed', mouth: 'gasp', brow: 'raised', tilt: k === 3 ? 1 : 0 })
    restL(c)
    restR(c)
    post(c, dust)
  } else if (k < 9) {
    // ACHOO: head snaps down, spray, one pellet rockets out of the mouth and off to the pile
    const t = k - 4
    body(c, { eyes: 'closed', mouth: t === 0 ? 'open' : 'sneeze', headDy: t < 2 ? 1 : 0, tail: t < 2 ? 2 : 0 })
    restL(c, t < 2 ? 1 : 0)
    restR(c, t < 2 ? 1 : 0)
    post(c, g => {
      const spray: Array<[number, number]> = t === 0 ? [[-6, -1], [-7, 1], [-8, -2], [-6, 2]] : t === 1 ? [[-9, -1], [-10, 2], [-11, -2], [-8, 1], [-12, 0]] : []
      for (const [x, y] of spray) g.set(M.x + x, M.y + y, 'c')
      const path: Array<[number, number]> = [[-8, 0], [-12, -1], [-15, 0], [-17, 2], [-18, 4]]
      const [px, py] = path[t]!
      pellet(g, Math.max(10, M.x + px), M.y + py, 'w')
      if (t === 3) for (const [x, y] of [[9, 12], [10, 14], [9, 16]] as Array<[number, number]>) g.set(x, y, 'c')
    })
  } else {
    body(c, { eyes: k === 9 ? 'dizzy' : k === 10 ? 'normal' : 'happy', mouth: k === 11 ? 'grin' : 'flat' })
    restL(c)
    restR(c)
    post(c, g => pellet(g, 11, 16, 'y'))
  }
}

function lookUp(c: Ctx, k: number) {
  const tilts: Array<-1 | 0 | 1> = [0, 1, 1, 1, -1, -1, 0, 0]
  const eyes = k === 3 ? 'closed' : k === 5 ? 'left' : k === 6 ? 'right' : k === 7 ? 'happy' : 'up'
  body(c, { eyes, mouth: k === 7 ? 'smile' : k >= 4 ? 'flat' : 'chew1', brow: k === 5 || k === 2 ? 'raised' : undefined, tilt: tilts[k], ear: k === 0 })
  restL(c)
  restR(c)
  if (k >= 2 && k <= 5) post(c, g => query(g, c.rx + 2, 1))
}

function golden(c: Ctx, k: number) {
  const { M, lx } = c
  const air: Array<[number, number]> = [[lx - 1, 2], [c.rx + 2, 3], [lx - 5, 7], [c.rx + 4, 7], [lx - 3, 11], [c.rx + 1, 0]]
  if (k === 0) {
    body(c, { eyes: 'up', mouth: 'chew1' })
    restL(c)
    restR(c)
    post(c, g => star(g, lx - 2, 2, true, 'Y'))
  } else if (k === 1) {
    // it drops out of nowhere on the can side
    body(c, { eyes: 'left', mouth: 'gasp', brow: 'raised' })
    restL(c)
    restR(c)
    post(c, g => goldPellet(g, lx - 4, 4))
  } else if (k <= 4) {
    // both paws, held up under the chin like a trophy
    body(c, { eyes: k === 2 ? 'wide' : 'sparkle', mouth: 'gasp', brow: k === 2 ? 'raised' : undefined, arms: 'hold' })
    post(c, g => {
      goldPellet(g, M.x - 1, M.y - 1)
      if (k >= 3) star(g, air[k - 3]![0], air[k - 3]![1], k === 4, 'Y'), star(g, air[k - 1]![0], air[k - 1]![1], k === 3, 'W')
    })
  } else if (k === 5) {
    body(c, { eyes: 'happy', mouth: 'open', arms: 'hold' })
    post(c, g => goldPellet(g, M.x - 1, M.y - 1))
  } else {
    // swallowed: Tonk glows gold for a beat and sparkles
    body(c, { eyes: 'happy', mouth: k === 6 ? 'chew0' : 'grin' })
    restL(c)
    restR(c)
    if (k === 6 || k === 7) post(c, g => (g.swap('g', 'Y'), g.swap('h', 'y')))
    post(c, g => air.forEach(([x, y], i) => (i + k) % 3 !== 0 && star(g, x, Math.max(1, y), (i + k) % 2 === 0, i % 2 ? 'Y' : 'W')))
  }
}

function doze(c: Ctx, k: number) {
  const { hp } = c
  if (k < 11) {
    // two nods: the head sinks, jerks back up awake-ish, sinks again and stays down
    const drop = [0, 1, 2, 0, 1, 2, 2, 2, 2, 2, 2][k]!
    const eyes = k === 3 ? 'lidded' : k < 2 ? 'lidded' : 'closed'
    body(c, { eyes, mouth: 'flat', brow: k === 3 ? 'raised' : undefined, headDy: drop, tilt: k >= 6 ? 1 : 0, tail: 0, ear: k === 3 })
    restL(c, drop)
    restR(c, drop)
    post(c, g => {
      if (k >= 4 && k < 8) zed(g, c.rx + 2, 1 + ((k + 1) % 2), false)
      if (k >= 8) {
        // snot bubble swelling from the nose, off to the side
        const r = k === 8 ? 0.8 : k === 9 ? 1.3 : 1.8
        const bx = hp.x + 7 - r
        const by = hp.y + 9 + drop
        g.ellipse(bx, by, r, r, 'a')
        g.set(Math.round(bx - r * 0.5), Math.round(by - r * 0.5), 'W')
      }
    })
  } else if (k === 11) {
    // POP: wide awake
    body(c, { eyes: 'wide', mouth: 'gasp', brow: 'raised', tail: 2, ear: true })
    restL(c)
    restR(c)
    post(c, g => {
      for (const [x, y] of [[-2, 7], [-4, 5], [-3, 10], [-1, 11], [-5, 8]] as Array<[number, number]>) g.set(hp.x + x, hp.y + y, 'c')
      bang(g, c.rx + 2, 1)
    })
  } else {
    const eyes = k === 12 ? 'left' : k === 13 ? 'right' : k === 14 ? 'normal' : 'happy'
    body(c, { eyes, mouth: k === 15 ? 'grin' : 'flat', brow: k < 14 ? 'raised' : undefined })
    restL(c)
    restR(c)
  }
}

/** The cape: red, a dark hem, high collar points flanking the head, drawn behind Tonk. */
function cape(c: Ctx, spread: boolean) {
  const { g, hp } = c
  const x0 = hp.x - (spread ? 8 : 3)
  const x1 = hp.x + 15 + (spread ? 8 : 3)
  const top = hp.y + (spread ? 6 : 9)
  for (let y = top; y <= 19; y++) {
    const t = (y - top) / (19 - top)
    const l = Math.round(hp.x + 2 - (hp.x + 2 - x0) * Math.sqrt(t))
    const r = Math.round(hp.x + 13 + (x1 - hp.x - 13) * Math.sqrt(t))
    for (let x = l; x <= r; x++) g.set(x, y, x === l || x === r || y === 19 ? 'R' : 'r')
  }
  if (spread) for (let x = x0 + 3; x <= x1 - 3; x += 5) g.set(x, 19, '.')
  // collar points rising behind the cheeks
  for (let i = 0; i < 4; i++) {
    g.set(hp.x - 1 - (i >> 1), hp.y + 10 - i, 'R')
    g.set(hp.x + 16 + (i >> 1), hp.y + 10 - i, 'R')
  }
}

function bandanaCape(c: Ctx, k: number) {
  const { hp, lx } = c
  const caped = k >= 2 && k <= 9
  const spread = k >= 3 && k <= 7
  if (caped) cape(c, spread)
  const bleh = k >= 4 && k <= 7
  body(c, {
    bandana: !caped && k !== 1 && k !== 10,
    eyes: bleh ? 'wide' : k === 0 ? 'lidded' : k >= 8 ? 'happy' : 'normal',
    mouth: bleh ? 'bleh' : k === 3 ? 'grin' : 'smile',
    brow: bleh || k === 0 || k === 3 ? 'annoyed' : undefined,
    tilt: k === 5 ? 1 : k === 6 ? -1 : 0,
  })
  if (k === 0) {
    restL(c)
    armR(c, { x: hp.x + 11, y: hp.y + 12 })
  } else if (spread) {
    // arms up and out, holding the cape wide
    armL(c, { x: hp.x - 7, y: hp.y + 8 })
    armR(c, { x: hp.x + 21, y: hp.y + 8 })
  } else {
    restL(c)
    restR(c)
  }
  post(c, g => {
    if (k === 1 || k === 10) {
      // the flip: a red swirl over the shoulders
      for (const [x, y, ch] of [[-2, 10, 'r'], [-3, 9, 'r'], [17, 9, 'R'], [18, 10, 'r'], [16, 12, 'r'], [19, 8, 'r']] as Array<[number, number, string]>) g.set(hp.x + x, hp.y + y, ch)
    }
    if (bleh) {
      // a tiny bat flaps by in the air left of the head
      const bx = 3 + (k - 4) * 3
      const by = 2 + (k % 2)
      const flap = k % 2 ? -1 : 1
      g.set(bx, by, 'r')
      g.set(bx - 1, by, 'm'), g.set(bx + 1, by, 'm')
      g.set(bx - 2, by + flap, 'm'), g.set(bx + 2, by + flap, 'm')
      void lx
    }
  })
}

const DRAW: Record<EventName, (c: Ctx, k: number) => void> = {
  wash,
  treasure,
  lid_hat: lidHat,
  juggle,
  sneeze,
  look_up: lookUp,
  golden,
  doze,
  bandana_cape: bandanaCape,
}

/** Draw event frame `k` for `state` into `g`; returns the post-outline effects pass. */
export function drawEvent(g: Grid, state: StateId, event: EventName, k: number): Post {
  const hp = HEAD_POS[state]
  const c: Ctx = {
    g, s: state, M: MOUTH[state], hp, L: SHOULDER_L[state], R: SHOULDER_R[state],
    lx: hp.x - 3, rx: hp.x + 17, posts: [],
  }
  // the floor first: can (unless the event owns it) and the pile behind Tonk
  if (event !== 'treasure' && event !== 'lid_hat') can(g)
  pile(g, PILE[state], k)
  DRAW[event](c, k)
  return gg => c.posts.forEach(p => p(gg))
}
