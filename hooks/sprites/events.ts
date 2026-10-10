// Random delight events: short one-shot bits Tonk does while idle. Each is a
// frame list played uniformly over `ms` (render.ts picks the frame from the
// event's progress). Choreography is written once against anchors (mouth,
// head, shoulders), so every awake body plays it at its own size; skinny gets
// thin arms and its forward head for free.

import type { Pellet, StateId } from '../core.ts'
import {
  Grid, HEAD_POS, LID, LID_TILT, MOUTH, PILE, SHOULDER_L, SHOULDER_R,
  arm, bang, can, drawBody, goldPellet, pellet, pile, query, star, zed,
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
  posts: Post[]
}

const add = (p: Pellet, dx: number, dy: number): Pellet => ({ x: p.x + dx, y: p.y + dy })

function body(c: Ctx, o: BodyOpts) {
  drawBody(c.g, c.s, { pose: c.s === 'snacking' || c.s === 'round' ? 2 : 0, arms: 'none', ...o })
}
function armL(c: Ctx, paw: Pellet) {
  arm(c.g, c.s, c.L, paw)
}
function armR(c: Ctx, paw: Pellet) {
  arm(c.g, c.s, c.R, paw)
}
const thin = (s: StateId) => s === 'skinny'
function restL(c: Ctx) {
  arm(c.g, c.s, c.L, thin(c.s) ? { x: c.L.x - 1, y: 18 } : add(c.L, 2, 4), false)
}
function restR(c: Ctx) {
  arm(c.g, c.s, c.R, thin(c.s) ? { x: c.R.x, y: 18 } : add(c.R, -2, 4), false)
}
function post(c: Ctx, f: Post) {
  c.posts.push(f)
}

/** A gold bottle cap with a crimped edge and a glint. */
const CAP = ['.YY.', 'YWYY', 'OYOY']

// ---- the events --------------------------------------------------------

function wash(c: Ctx, k: number) {
  const { M } = c
  const puddle = (g: Grid, splash: number) => {
    for (let x = 12; x <= 19; x++) g.set(x, 19, x === 14 || x === 17 ? 'a' : 's')
    for (let x = 13; x <= 18; x++) g.set(x, 18, x === 15 ? 'a' : 's')
    if (splash === 1) for (const [x, y] of [[12, 16], [19, 15], [16, 15], [14, 17]] as Array<[number, number]>) g.set(x, y, 'a')
    if (splash === 2) for (const [x, y] of [[11, 15], [20, 14], [16, 13], [13, 14], [18, 16], [15, 16]] as Array<[number, number]>) g.set(x, y, 's')
  }
  const suds = (g: Grid, k: number) => {
    const ring: Array<[number, number]> = [[-5, 3], [-4, 1], [-1, 2], [2, 2], [3, 4], [1, 6], [-3, 6], [-5, 5]]
    for (let i = 0; i < ring.length; i += 2) {
      const [x, y] = ring[(i + k) % ring.length]!
      g.set(M.x + x, M.y + y, i % 4 ? 'a' : 'W')
    }
  }
  const chestL = add(M, -3, 4)
  const chestR = add(M, 2, 4)
  if (k === 0) {
    body(c, { eyes: 'normal', mouth: 'smile' })
    armL(c, { x: 17, y: 16 })
    restR(c)
    post(c, g => puddle(g, 0))
  } else if (k === 1) {
    body(c, { eyes: 'normal', mouth: 'smile' })
    armL(c, add(M, -7, 3))
    restR(c)
    post(c, g => (puddle(g, 0), pellet(g, M.x - 8, M.y + 1, 'y')))
  } else if (k === 2) {
    body(c, { eyes: 'squint', mouth: 'flat' })
    armL(c, { x: 16, y: 17 })
    restR(c)
    post(c, g => puddle(g, 1))
  } else if (k === 3) {
    body(c, { eyes: 'squint', mouth: 'flat' })
    armL(c, { x: 16, y: 16 })
    restR(c)
    post(c, g => puddle(g, 2))
  } else if (k <= 7) {
    // the scrub: paws rub up and down against each other, drops fly
    const up = k % 2 === 0
    body(c, { eyes: 'lidded', mouth: k === 5 ? 'smile' : 'flat' })
    // no outline: gray arms on the light belly read fine, and outlines boxed the chest in black
    arm(c.g, c.s, c.L, add(chestL, 0, up ? -1 : 1), false)
    arm(c.g, c.s, c.R, add(chestR, 0, up ? 1 : -1), false)
    post(c, g => {
      puddle(g, 0)
      g.set(M.x - 1, M.y + 4, 'o'), g.set(M.x, M.y + 4, k % 2 ? 'y' : 'w')
      suds(g, k)
      const drops: Array<[number, number]> = up ? [[-6, 2], [5, 1], [-5, 6]] : [[-7, 4], [6, 3], [4, 6]]
      for (const [dx, dy] of drops) g.set(M.x + dx, M.y + dy, k % 2 ? 's' : 'a')
    })
  } else if (k === 8) {
    body(c, { eyes: 'wide', mouth: 'grin', brow: 'raised' })
    armL(c, add(M, -6, -1))
    restR(c)
    post(c, g => (puddle(g, 0), pellet(g, M.x - 7, M.y - 4, 'w'), star(g, M.x - 9, M.y - 5)))
  } else if (k === 9) {
    body(c, { eyes: 'happy', mouth: 'open' })
    armL(c, add(M, -3, 1))
    restR(c)
    post(c, g => (puddle(g, 0), pellet(g, M.x - 2, M.y - 1, 'w')))
  } else {
    body(c, { eyes: 'happy', mouth: k === 10 ? 'chew0' : 'chew1' })
    restL(c)
    restR(c)
    post(c, g => puddle(g, 0))
  }
}

function treasure(c: Ctx, k: number) {
  const { M, hp } = c
  const capAt = (p: Pellet) => c.g.stamp(p.x, p.y, CAP)
  if (k > 2) can(c.g)
  if (k <= 2) {
    const jolt = k === 1 ? -1 : k === 2 ? 1 : 0
    can(c.g, { dx: jolt })
    body(c, { eyes: k === 0 ? 'normal' : 'squint', mouth: 'flat', brow: k === 0 ? 'raised' : 'annoyed', tail: k === 1 ? 1 : 0 })
    armL(c, { x: 9 + jolt, y: 13 + (k % 2) })
    restR(c)
    if (k > 0) post(c, g => {
      for (const [x, y] of [[1, 8], [3, 7], [12, 10], [13, 12]] as Array<[number, number]>) g.set(x + jolt, y, 'c')
    })
  } else if (k === 3) {
    body(c, { eyes: 'wide', mouth: 'gasp', brow: 'raised' })
    armL(c, add(M, -8, 1))
    restR(c)
    capAt(add(M, -10, -1))
    post(c, g => star(g, M.x - 11, M.y - 3))
  } else if (k <= 6) {
    body(c, { eyes: 'sparkle', mouth: k === 5 ? 'grin' : 'gasp' })
    armL(c, add(M, -7, -2))
    restR(c)
    capAt(add(M, -9, -5))
    const twinkles: Array<Array<[number, number, boolean]>> = [
      [[-11, -7, true], [-5, -3, false]],
      [[-6, -8, false], [-12, -2, true]],
      [[-10, -8, true], [-4, -6, false], [-12, -4, false]],
    ]
    post(c, g => {
      for (const [dx, dy, big] of twinkles[k - 4]!) star(g, M.x + dx, M.y + dy, big)
    })
  } else {
    // tucked under the bandana: a glint peeks out of the knot
    // the cap rides on the bandana for the rest of the event: 2x2, bright, with a shine
    const capX = hp.x + 7
    const capY = hp.y + 11
    body(c, { eyes: 'happy', mouth: 'smile' })
    // the tuck paw comes in low, under the chin, so it never covers the mouth
    if (k === 7) armL(c, { x: capX - 2, y: capY + 1 })
    else restL(c)
    if (k === 8) armR(c, { x: capX + 2, y: capY + 1 })
    else restR(c)
    post(c, g => {
      g.stamp(capX, capY, ['WY', 'YO'])
      if (k >= 8) star(g, capX + 3, capY - 1, k === 9, 'W')
    })
  }
}

function lidHat(c: Ctx, k: number) {
  const { hp } = c
  const lidOnCan = k === 0 || k === 11
  can(c.g, { lid: lidOnCan })
  const helmet = k >= 3 && k <= 9
  const salute = k >= 5 && k <= 8
  body(c, {
    helmet,
    eyes: k === 3 ? 'closed' : salute ? 'normal' : k === 10 || k === 11 ? 'happy' : 'normal',
    mouth: salute ? (k >= 7 ? 'grin' : 'flat') : 'grin',
    brow: salute && k < 7 ? 'annoyed' : undefined,
    headDy: k === 3 ? 1 : 0,
  })
  if (k === 0) {
    armL(c, { x: 6, y: 8 })
    restR(c)
  } else if (k === 1) {
    armL(c, { x: hp.x - 5, y: 6 })
    restR(c)
    c.g.stamp(hp.x - 10, 4, LID)
  } else if (k === 2) {
    armL(c, { x: hp.x - 1, y: hp.y + 1 })
    restR(c)
    c.g.stamp(hp.x - 2, hp.y - 1, LID_TILT)
  } else if (k === 3 || k === 4) {
    armL(c, { x: hp.x, y: hp.y + 2 })
    restR(c)
    if (k === 3) post(c, g => {
      for (const [x, y] of [[-2, 0], [-3, 2], [14, 0], [15, 2]] as Array<[number, number]>) g.set(hp.x + x, hp.y + y, 'c')
    })
  } else if (salute) {
    restL(c)
    // paw snapped to the brim
    armR(c, { x: hp.x + 11, y: hp.y + 2 })
    if (k >= 7) post(c, g => star(g, hp.x + 4, hp.y, k === 8))
  } else if (k === 9) {
    restL(c)
    restR(c)
  } else if (k === 10) {
    armL(c, { x: hp.x - 3, y: hp.y + 3 })
    restR(c)
    c.g.stamp(7, 3, LID_TILT)
    post(c, g => {
      for (const [x, y] of [[15, 3], [16, 5], [14, 1]] as Array<[number, number]>) g.set(x, y, 'c')
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
  const { hp } = c
  // a small two-pellet loop off to the can side of the head, one paw tossing, so
  // nothing crosses the face and no arm crosses the chest
  const hy = Math.min(hp.y + 10, 11)
  const pl: Pellet = { x: hp.x - 6, y: hy }
  const top = Math.max(1, hy - 7)
  const cx = hp.x - 6
  const cy = (hy + top) / 2
  const at = (u: number): Pellet => {
    // up the right side, over the top, down the left side, caught at the bottom
    const th = 2 * Math.PI * (((u % 1) + 1) % 1)
    return { x: cx + 2.5 * Math.sin(th), y: cy + ((hy - top) / 2) * Math.cos(th) }
  }
  const catchL = add(pl, 0, 2)
  if (k < 16) {
    const u = k / 8
    const balls = [0, 0.5].map(o => at(u + o))
    const dip = balls.some(b => b.y > hy - 1.5) ? 1 : 0
    body(c, { eyes: k % 8 < 4 ? 'left' : 'up', mouth: k % 8 < 4 ? 'grin' : 'smile', brow: 'raised' })
    armL(c, add(catchL, 0, dip))
    restR(c)
    post(c, g => balls.forEach(b => pellet(g, Math.round(b.x) - 1, Math.round(b.y) - 1, 'y')))
  } else if (k < 18) {
    // one goes way too high: one caught, eyes track the other off the top
    body(c, { eyes: 'up', mouth: 'gasp', brow: 'raised' })
    armL(c, add(catchL, 0, -1))
    restR(c)
    post(c, g => {
      pellet(g, pl.x - 1, pl.y - 1, 'y')
      if (k === 16) pellet(g, hp.x + 1, 0, 'w')
    })
  } else if (k < 20) {
    // BONK
    const bonk = k === 19
    body(c, { eyes: bonk ? 'dizzy' : 'up', mouth: bonk ? 'flat' : 'gasp', headDy: bonk ? 1 : 0, ear: bonk })
    armL(c, add(catchL, 0, 1))
    restR(c)
    post(c, g => {
      pellet(g, pl.x - 1, pl.y + 1, 'y')
      if (bonk) {
        pellet(g, hp.x + 5, hp.y - 1, 'w')
        for (const [x, y] of [[2, 0], [10, 0], [1, 2], [11, 2]] as Array<[number, number]>) g.set(hp.x + x, hp.y + y, 'c')
      } else pellet(g, hp.x + 5, -2, 'w')
    })
  } else {
    // dizzy stars circle, then a sheepish grin; the stray pellet rolls off
    const dizzy = k < 23
    body(c, { eyes: dizzy ? 'dizzy' : 'happy', mouth: dizzy ? 'flat' : 'grin', tilt: dizzy ? (k % 2 ? 1 : -1) : 0 })
    restL(c)
    restR(c)
    post(c, g => {
      if (dizzy) {
        const ring: Array<[number, number]> = [[0, 0], [6, -1], [12, 0], [9, 1], [3, 1]]
        for (let i = 0; i < 3; i++) {
          const [x, y] = ring[(i * 2 + k) % ring.length]!
          star(g, hp.x + x, hp.y + 1 + y, false, i === 0 ? 'W' : 'Y')
        }
      }
      pellet(g, Math.max(0, hp.x - 4 - (k - 20) * 2), 16, 'y')
    })
  }
}

function sneeze(c: Ctx, k: number) {
  const { M } = c
  const dust = (g: Grid) => {
    for (const [x, y] of [[-3, -3], [0, -4], [2, -2], [-2, -6]] as Array<[number, number]>) g.set(M.x + x + (k % 2), M.y + y, 'y')
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
    // ACHOO: head snaps down, spray, one pellet rockets out
    const t = k - 4
    body(c, { eyes: 'closed', mouth: t === 0 ? 'open' : 'sneeze', headDy: t < 2 ? 1 : 0, tail: t < 2 ? 2 : 0 })
    restL(c)
    restR(c)
    post(c, g => {
      const spray: Array<[number, number]> = t === 0 ? [[-3, 0], [-4, 2], [-5, -1], [-3, 3]] : t === 1 ? [[-6, 0], [-7, 3], [-8, -1], [-5, 2], [-9, 1]] : []
      for (const [x, y] of spray) g.set(M.x + x, M.y + y, 'c')
      const path: Array<[number, number]> = [[-6, 0], [-11, -1], [-16, 0], [-19, 2], [-20, 5]]
      const [px, py] = path[t]!
      pellet(g, Math.max(10, M.x + px), M.y + py, 'w')
      if (t === 3) for (const [x, y] of [[9, 9], [10, 11], [9, 13]] as Array<[number, number]>) g.set(x, y, 'c')
    })
  } else {
    body(c, { eyes: k === 9 ? 'dizzy' : k === 10 ? 'normal' : 'happy', mouth: k === 11 ? 'grin' : 'flat' })
    restL(c)
    restR(c)
    post(c, g => pellet(g, 12, 16, 'y'))
  }
}

function lookUp(c: Ctx, k: number) {
  const { hp } = c
  const tilts: Array<-1 | 0 | 1> = [0, 1, 1, 1, -1, -1, 0, 0]
  const eyes = k === 3 ? 'closed' : k === 5 ? 'left' : k === 6 ? 'right' : k === 7 ? 'happy' : 'up'
  body(c, { eyes, mouth: k === 7 ? 'smile' : k >= 4 ? 'flat' : 'chew1', brow: k === 5 || k === 2 ? 'raised' : undefined, tilt: tilts[k], ear: k === 0 })
  restL(c)
  restR(c)
  if (k >= 2 && k <= 5) post(c, g => query(g, Math.min(40, hp.x + 15), 1))
}

function golden(c: Ctx, k: number) {
  const { M, hp } = c
  const gx = M.x - 1
  if (k === 0) {
    body(c, { eyes: 'up', mouth: 'chew1' })
    restL(c)
    restR(c)
    post(c, g => star(g, gx + 1, 1, true, 'Y'))
  } else if (k === 1) {
    body(c, { eyes: 'wide', mouth: 'gasp', brow: 'raised' })
    restL(c)
    restR(c)
    post(c, g => goldPellet(g, gx - 8, 1))
  } else if (k <= 4) {
    const held = add(M, -1, 3)
    body(c, { eyes: k === 2 ? 'wide' : 'sparkle', mouth: 'gasp', brow: k === 2 ? 'raised' : undefined })
    armL(c, add(held, -3, 1))
    armR(c, add(held, 3, 1))
    post(c, g => {
      goldPellet(g, held.x - 1, held.y - 1)
      if (k >= 3) star(g, held.x - 6, held.y - 4, k === 4, 'Y'), star(g, held.x + 6, held.y - 5, k === 3, 'W')
    })
  } else if (k === 5) {
    body(c, { eyes: 'happy', mouth: 'open' })
    armL(c, add(M, -3, 1))
    armR(c, add(M, 2, 1))
    post(c, g => goldPellet(g, M.x - 1, M.y - 1))
  } else {
    // swallowed: Tonk glows gold for a beat and sparkles
    body(c, { eyes: 'happy', mouth: k === 6 ? 'chew0' : 'grin' })
    restL(c)
    restR(c)
    if (k === 6 || k === 7) post(c, g => (g.swap('g', 'Y'), g.swap('h', 'y')))
    const spots: Array<Array<[number, number]>> = [
      [[-12, -6], [8, -7], [-9, 4], [10, 3]],
      [[-8, -8], [12, -4], [-13, 1], [6, 6]],
      [[-11, -3], [9, -8], [-6, 6], [12, 1]],
      [[-13, -7], [11, -6], [-10, 5], [7, 5]],
    ]
    post(c, g => spots[k - 6]!.forEach(([x, y], i) => star(g, M.x + x, Math.max(1, M.y + y), (i + k) % 2 === 0, i % 2 ? 'Y' : 'W')))
    void hp
  }
}

function doze(c: Ctx, k: number) {
  const { hp } = c
  if (k < 11) {
    // two nods: the head sinks 2 px, jerks back up awake-ish, sinks again and stays down
    const drop = [0, 1, 2, 0, 1, 2, 2, 2, 2, 2, 2][k]!
    const eyes = k === 3 ? 'lidded' : k < 2 ? 'lidded' : 'closed'
    body(c, { eyes, mouth: 'chew1', brow: k === 3 ? 'raised' : undefined, headDy: drop, tilt: k >= 6 ? 1 : 0, tail: 0, ear: k === 3 })
    restL(c)
    restR(c)
    post(c, g => {
      if (k >= 4 && k < 8) zed(g, hp.x + 13, 2 + ((k + 1) % 2), false)
      if (k >= 8) {
        // snot bubble swelling from the nose
        const r = k === 8 ? 0.8 : k === 9 ? 1.4 : 2
        const bx = hp.x + 3
        const by = hp.y + 7 + drop
        g.ellipse(bx - r, by, r, r, 'a')
        g.set(Math.round(bx - r - r * 0.5), by - 1, 'W')
      }
    })
  } else if (k === 11) {
    // POP: wide awake
    body(c, { eyes: 'wide', mouth: 'gasp', brow: 'raised', tail: 2, ear: true })
    restL(c)
    restR(c)
    post(c, g => {
      for (const [x, y] of [[-1, 6], [-4, 5], [-3, 9], [0, 9], [-5, 7]] as Array<[number, number]>) g.set(hp.x + x, hp.y + y, 'c')
      bang(g, Math.min(41, hp.x + 15), 1)
    })
  } else {
    const eyes = k === 12 ? 'left' : k === 13 ? 'right' : k === 14 ? 'normal' : 'happy'
    body(c, { eyes, mouth: k === 15 ? 'grin' : 'flat', brow: k < 14 ? 'raised' : undefined })
    restL(c)
    restR(c)
  }
}

/** The cape: dark outside, red lining, high Dracula collar flanking the head. */
function cape(c: Ctx, spread: boolean) {
  const { g, hp } = c
  const x0 = hp.x - (spread ? 9 : 4)
  const x1 = hp.x + 12 + (spread ? 9 : 4)
  const top = hp.y + (spread ? 6 : 9)
  for (let y = top; y <= 19; y++) {
    const t = (y - top) / (19 - top)
    const l = Math.round(hp.x + 1 - (hp.x + 1 - x0) * Math.sqrt(t))
    const r = Math.round(hp.x + 11 + (x1 - hp.x - 11) * Math.sqrt(t))
    for (let x = l; x <= r; x++) g.set(x, y, x <= l + 1 || x >= r - 1 ? 'm' : (x + y) % 5 === 0 ? 'R' : 'r')
  }
  if (spread) {
    // scalloped hem between the wing ribs
    for (let x = x0; x <= x1; x += 4) g.set(x, 19, '.')
  }
  // collar points
  for (let i = 0; i < 6; i++) {
    g.set(hp.x - 1 - (i >> 1), hp.y + 9 - i, i % 2 ? 'R' : 'r')
    g.set(hp.x - (i >> 1), hp.y + 9 - i, 'r')
    g.set(hp.x + 13 + (i >> 1), hp.y + 9 - i, i % 2 ? 'R' : 'r')
    g.set(hp.x + 12 + (i >> 1), hp.y + 9 - i, 'r')
  }
}

function bandanaCape(c: Ctx, k: number) {
  const { hp } = c
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
    armR(c, { x: hp.x + 9, y: hp.y + 10 })
  } else if (spread) {
    // arms up and out, holding the cape wide
    armL(c, { x: hp.x - 7, y: hp.y + 7 })
    armR(c, { x: hp.x + 18, y: hp.y + 7 })
  } else {
    restL(c)
    restR(c)
  }
  post(c, g => {
    if (k === 1 || k === 10) {
      // the flip: a red swirl over the shoulders
      for (const [x, y, ch] of [[-2, 8, 'r'], [-1, 7, 'r'], [13, 7, 'R'], [14, 8, 'r'], [6, 11, 'r'], [7, 12, 'R'], [15, 6, 'r']] as Array<[number, number, string]>) g.set(hp.x + x, hp.y + y, ch)
    }
    if (bleh) {
      // a tiny bat flaps by
      const bx = 3 + (k - 4) * 3
      const by = 2 + (k % 2)
      const wing = k % 2 ? 'm' : '.'
      g.set(bx, by, 'm'), g.set(bx - 1, by - (k % 2 ? 1 : 0), 'm'), g.set(bx + 1, by - (k % 2 ? 1 : 0), 'm')
      if (wing !== '.') g.set(bx - 2, by - 1, 'm'), g.set(bx + 2, by - 1, 'm')
      else g.set(bx - 2, by + 1, 'm'), g.set(bx + 2, by + 1, 'm')
      g.set(bx, by, 'r')
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
  const c: Ctx = { g, s: state, M: MOUTH[state], hp: HEAD_POS[state], L: SHOULDER_L[state], R: SHOULDER_R[state], posts: [] }
  // the floor first: can (unless the event owns it) and the pile behind Tonk
  if (event !== 'treasure' && event !== 'lid_hat') can(g)
  pile(g, PILE[state], k)
  DRAW[event](c, k)
  return gg => c.posts.forEach(p => p(gg))
}
