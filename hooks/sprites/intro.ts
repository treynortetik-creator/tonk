// The can intro: the trash can stands upright with its lid on, Tonk (at his
// current size) waddles over, hooks the rim and yanks it down toward himself,
// the lid clatters onto the fallen can, pellets spill across the floor, and he
// grins. Twelve uniform frames over core INTRO_MS; holds are repeated poses.

import type { Pellet, StateId } from '../core.ts'
import {
  CAN_X, CAN_Y, Grid, H, HEAD_POS, LID, W, LID_EDGE, LID_TILT, LID_TILT_R, PILE, SHOULDER_L, SLOTS, UPRIGHT_CAN, UPRIGHT_X, UPRIGHT_Y,
  arm, bang, can, drawBody, pellet, type Brow, type Eyes, type Mouth,
} from './base.ts'

export const INTRO_FRAMES = 12

type CanPose = { angle: number; lid: boolean } | 'tipped'
type LidPose = { art: readonly string[]; x: number; y: number } | 'rest' | null
type IntroPose = {
  dx: number
  can: CanPose
  lid: LidPose
  reach: boolean
  eyes: Eyes
  mouth: Mouth
  brow?: Brow
  tail?: 0 | 1 | 2
  ear?: boolean
  spill: number
  dust?: boolean
  clang?: boolean
  motion?: boolean
  surprise?: boolean
}

const POSES: IntroPose[] = [
  { dx: 8, can: { angle: 0, lid: true }, lid: null, reach: false, eyes: 'wide', mouth: 'grin', brow: 'hungry', spill: -1, surprise: true },
  { dx: 5, can: { angle: 0, lid: true }, lid: null, reach: false, eyes: 'wide', mouth: 'grin', brow: 'hungry', tail: 1, spill: -1 },
  { dx: 2, can: { angle: 0, lid: true }, lid: null, reach: false, eyes: 'wide', mouth: 'grin', brow: 'hungry', tail: 2, spill: -1 },
  { dx: 0, can: { angle: 0, lid: true }, lid: null, reach: true, eyes: 'lidded', mouth: 'grin', brow: 'annoyed', spill: -1 },
  { dx: 0, can: { angle: 8, lid: true }, lid: null, reach: true, eyes: 'lidded', mouth: 'grin', brow: 'annoyed', ear: true, spill: -1 },
  { dx: 0, can: { angle: 32, lid: true }, lid: null, reach: true, eyes: 'wide', mouth: 'grit', brow: 'annoyed', spill: -1, motion: true },
  { dx: 0, can: { angle: 64, lid: false }, lid: { art: LID_TILT, x: 9, y: 1 }, reach: true, eyes: 'wide', mouth: 'open', spill: -1, motion: true },
  { dx: 0, can: 'tipped', lid: { art: LID_EDGE, x: 5, y: 1 }, reach: false, eyes: 'wide', mouth: 'open', brow: 'raised', spill: 0.12, dust: true },
  { dx: 0, can: 'tipped', lid: { art: LID_TILT_R, x: 1, y: 5 }, reach: false, eyes: 'wide', mouth: 'open', brow: 'raised', spill: 0.4, clang: true },
  { dx: 0, can: 'tipped', lid: 'rest', reach: false, eyes: 'happy', mouth: 'open', spill: 0.72 },
  { dx: 0, can: 'tipped', lid: 'rest', reach: false, eyes: 'happy', mouth: 'grin', tail: 2, spill: 1 },
  { dx: 0, can: 'tipped', lid: 'rest', reach: false, eyes: 'happy', mouth: 'grin', spill: 1 },
]

/**
 * Hand-drawn tilt poses (no runtime rotation: it made jaggy stripes). Every rib
 * and edge is a clean 4:1, 2:1 or 1:2 staircase; each pose pivots near the
 * can's bottom-right foot and lists where the paw hooks the rim.
 */
type Tilt = { art: readonly string[]; x: number; rim: Pellet }
const TILTS: Record<number, Tilt> = {
  // ~14 deg: the can rocks up onto its right edge, lid still on
  8: {
    x: 1,
    rim: { x: 12, y: 2 },
    art: [
      '....qqq.qT...',
      '...qqqqqqqq..',
      '....tqqqqqqqq',
      '..tttttqqqqqT',
      '..tTTTTtttTT.',
      '..tttttTTTTTT',
      '..tttuttttTTT',
      '.ttutttttTTT.',
      '.tTttttttTTT.',
      '.ttTTTTutTTT.',
      '.tuttttTTTTT.',
      'ttttttutTTT..',
      'ttttutttTTT..',
      '.tttttttTTT..',
      '...tttttTTT..',
      '.......TT....',
    ],
  },
  // ~27 deg: yanked over, lid rattling
  32: {
    x: 2,
    rim: { x: 12, y: 3 },
    art: [
      '......q......',
      '.....qqqqqT..',
      '....ttqqqqq..',
      '...tTttqqqqqq',
      '...ttTTttqqqq',
      '..tttttTTtTT.',
      '..ttuutttTTTT',
      '.tTttttttTTT.',
      '.ttTTttttTTT.',
      'tutttTTtTTT..',
      'tttttttTTTT..',
      'tttututTTT...',
      '.ttttttTTT...',
      '...tttTTT....',
      '.....tTTT....',
    ],
  },
  // ~63 deg: the lid has flown, the glowing mouth swings toward Tonk
  64: {
    x: 1,
    rim: { x: 9, y: 0 },
    art: [
      '........tty...',
      '......ttTtO...',
      '....tttttTtO..',
      '..ttTtuttTty..',
      '.ttutTttttTtO.',
      'tttttTttttTty.',
      '.tttttTttttTTO',
      '.ttuttTuttTTTO',
      '..tttutTTTTTTT',
      '..ttttTTTTTT..',
      '...tTTTTTT....',
      '...TTTTT......',
      '.....T........',
    ],
  },
}

/** The can at an intro angle: 0 = the upright literal, else a hand-drawn tilt resting on the floor. */
function tiltedCan(g: Grid, deg: number): Pellet | null {
  if (deg === 0) {
    g.stamp(UPRIGHT_X, UPRIGHT_Y, UPRIGHT_CAN)
    return { x: UPRIGHT_X + 8, y: UPRIGHT_Y + 1 }
  }
  const t = TILTS[deg]!
  const y0 = H - t.art.length
  g.stamp(t.x, y0, t.art)
  return { x: t.x + t.rim.x, y: y0 + t.rim.y }
}

/**
 * Pellets leaving the can mouth and hopping to their floor slots. Landed ones
 * go down before Tonk (behind him, like the idle pile); ones in flight go on top.
 */
function spill(g: Grid, n: number, p: number, landed: boolean) {
  const mouth = { x: 9, y: 13 }
  for (let i = 0; i < Math.min(n, SLOTS.length); i++) {
    const t = Math.max(0, Math.min(1, (p - i * 0.05) / 0.55))
    if (t <= 0 || (t >= 1) !== landed) continue
    const [sx, sy] = SLOTS[i]!
    const x = mouth.x + (sx - mouth.x) * t
    const y = mouth.y + (sy - mouth.y) * t - Math.sin(Math.PI * t) * 3
    pellet(g, Math.round(x), Math.round(y), t >= 1 ? (i % 3 === 0 ? 'w' : 'y') : 'w')
  }
}

export function drawIntro(g: Grid, state: StateId, frame: number, drained: boolean): { post: (g: Grid) => void } {
  const k = Math.max(0, Math.min(INTRO_FRAMES - 1, Math.floor(frame)))
  const P = POSES[k]!
  // can first (behind Tonk's reaching paw)
  let rimPaw: Pellet | null = null
  if (P.can === 'tipped') {
    can(g, { drained, lid: P.lid === 'rest', dy: P.dust ? 0 : 0 })
  } else {
    rimPaw = tiltedCan(g, P.can.angle)
  }
  if (P.lid && P.lid !== 'rest') g.stamp(P.lid.x, P.lid.y, P.lid.art)
  const n = drained ? 0 : PILE[state]
  if (P.spill >= 0) spill(g, n, P.spill, true)
  const body = state === 'asleep' || state === 'coma' || state === 'workout' ? (state === 'coma' ? 'bloated' : 'skinny') : state
  const sleepy = state === 'asleep'
  drawBody(g, body, {
    dx: P.dx,
    arms: P.reach ? 'right' : 'pose',
    pose: body === 'snacking' || body === 'round' ? 2 : 0,
    eyes: sleepy ? 'closed' : P.eyes,
    mouth: sleepy && k < 7 ? 'chew1' : P.mouth,
    brow: sleepy ? undefined : P.brow,
    tail: P.tail,
    ear: P.ear,
  })
  if (P.reach && rimPaw) {
    const sh = SHOULDER_L[body]
    arm(g, body, sh, { x: rimPaw.x, y: rimPaw.y })
  }
  return {
    post: (gg: Grid) => {
      if (P.spill >= 0) spill(gg, n, P.spill, false)
      if (P.dust) {
        for (const [x, y] of [[0, 18], [1, 17], [11, 18], [12, 17], [13, 19], [-1, 19]] as Array<[number, number]>) gg.set(CAN_X + x, y, 'c')
      }
      if (P.clang) {
        bang(gg, 0, 1)
        for (const [x, y] of [[9, 6], [10, 5], [9, 8], [10, 9]] as Array<[number, number]>) gg.set(x, y, 'c')
      }
      if (P.motion) for (const [x, y] of [[11, 4], [12, 5], [13, 7], [12, 9]] as Array<[number, number]>) gg.set(x, y, 'c')
      if (P.surprise && !sleepy) bang(gg, Math.min(W - 2, HEAD_POS[body].x + P.dx + 13), 1)
      void CAN_Y
      void LID
    },
  }
}
