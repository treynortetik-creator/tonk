// Renders Tonk's frames and animations for review:
//   previews/*.png            every idle/poke/munch/burst/chomp frame at 12x
//   previews/all-states.png   contact sheet of those
//   previews/hero-progression.png   the six bodies, 3x2, 16x
//   previews/intro-sheet.png, delight-sheet.png, micro-sheet.png   round-3 contact sheets
//   previews/tonk-*.gif       animations at real timing (one tick = TICK_MS)
// Run: node scripts/preview.ts   (needs ImageMagick `magick`)
import { mkdirSync, writeFileSync, rmSync, readdirSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BANG_MS, BORED_MS, FRANTIC_MS, INTRO_MS, TICK_MS, burstFrame, streamFrame, type StateId } from '../hooks/core.ts'
import { bandFrame, chompFrame } from '../hooks/render.ts'
import {
  CAN_MOUTH, CHOMP_CAN, CHOMP_MOUTH, EVENTS, EVENT_NAMES, FRAME_COUNT, H, INTRO_FRAMES, JIGGLE_FRAMES, MOUTH, PALETTE,
  POKE_SEQUENCE, SEQUENCE, W, buildCanFrame, buildChomp, buildEventFrame, buildFrame, type EventName, type Extras,
} from '../hooks/sprites.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'previews')
const tmp = join(out, '.tmp')
mkdirSync(out, { recursive: true })
mkdirSync(tmp, { recursive: true })
for (const f of readdirSync(out)) if (f.endsWith('.png') || f.endsWith('.gif')) rmSync(join(out, f))

const BG = 0x20232a
const SCALE = 12
const FONT = '/System/Library/Fonts/Supplemental/Arial.ttf'
const PAL: Record<string, number> = { ...PALETTE, '#': 0x14161b }

function ppm(frame: string[], path: string, bg = BG) {
  const h = frame.length
  const w = frame[0]!.length
  const buf = Buffer.alloc(w * h * 3)
  frame.forEach((row, y) => {
    for (let x = 0; x < w; x++) {
      const c = row[x]! === '.' ? bg : PAL[row[x]!]!
      buf[(y * w + x) * 3] = (c >> 16) & 255
      buf[(y * w + x) * 3 + 1] = (c >> 8) & 255
      buf[(y * w + x) * 3 + 2] = c & 255
    }
  })
  writeFileSync(path, Buffer.concat([Buffer.from(`P6\n${w} ${h}\n255\n`), buf]))
}

/** Center a smaller frame (the chomper) on a W x H band so GIF frames share one size. */
function onBand(frame: string[]): string[] {
  const fw = frame[0]!.length
  const fh = frame.length
  const x0 = Math.floor((W - fw) / 2)
  const y0 = Math.floor((H - fh) / 2)
  return Array.from({ length: H }, (_, y) => {
    const r = frame[y - y0]
    if (!r) return '.'.repeat(W)
    return '.'.repeat(x0) + r + '.'.repeat(W - fw - x0)
  })
}

const labeled: Array<{ file: string; label: string }> = []
function png(name: string, frame: string[], scale = SCALE, dir = out) {
  const src = join(tmp, `${name}.ppm`)
  ppm(frame, src)
  const dst = join(dir, `${name}.png`)
  execFileSync('magick', [src, '-filter', 'point', '-scale', `${scale * 100}%`, dst])
  return dst
}
function emit(name: string, label: string, frame: string[]) {
  labeled.push({ file: png(name, frame), label })
}
function sheet(name: string, items: Array<[string, string[]]>, cols: number, scale: number) {
  const args = ['montage']
  items.forEach(([label, rows], i) => args.push('-label', label, png(`${name}-${i}`, rows, scale, tmp)))
  args.push('-tile', `${cols}x`, '-geometry', '+8+8', '-background', '#14161b', '-fill', '#d8d8d8', '-font', FONT, '-pointsize', '15', join(out, `${name}.png`))
  execFileSync('magick', args)
}

const STATES: StateId[] = ['asleep', 'skinny', 'snacking', 'round', 'huge', 'bloated', 'coma', 'workout']
const AWAKE: StateId[] = ['skinny', 'snacking', 'round', 'huge', 'bloated']
for (const s of STATES) for (let i = 0; i < FRAME_COUNT[s]; i++) emit(`${s}-${i}`, `${s} ${i}`, buildFrame(s, i))

// idle impatience: every distinct pose, for every body that can poke
for (const tier of ['bored', 'frantic', 'bang'] as const) {
  const poses = [...new Set(POKE_SEQUENCE[tier])]
  for (const s of AWAKE)
    for (const p of poses) {
      const f = POKE_SEQUENCE[tier].indexOf(p)
      emit(`poke-${tier}-${s}-${p}`, `${tier} ${s} ${p}`, buildFrame(s, f, { poke: tier }))
    }
}

// munch: live eating (stream of pellets from the can into the mouth), skinny and round
for (const s of ['skinny', 'round'] as StateId[])
  [0, 300, 600].forEach((t, k) => {
    const sf = streamFrame(t, CAN_MOUTH, MOUTH[s])
    emit(`munch-${s}-${k}`, `munch ${s} ${k}`, buildFrame(s, 0, { pellets: sf.pellets, mouth: sf.isMouthOpen ? 'open' : 'chew1' }))
  })

// burst: pellets fall into the band, round Tonk gobbles
;[100, 400, 700, 1000].forEach((t, k) => {
  const bf = burstFrame({ start: 0, n: 8 }, t, MOUTH.round)
  emit(`burst-round-${k}`, `burst round t=${t}ms`, buildFrame('round', 2, { pellets: bf.pellets, mouth: bf.isMouthOpen ? 'open' : bf.isChewing ? 'chew1' : 'chew0' }))
})

// spinner chomper
;[0, 200, 400, 600, 800].forEach((t, k) => {
  const sf = streamFrame(t, CHOMP_CAN, CHOMP_MOUTH, 3, 2)
  emit(`chomp-${k}`, `spinner chomp ${k}`, buildChomp(sf.isMouthOpen, sf.pellets))
})

// the can on its own
for (const look of ['upright', 'tipped', 'drained'] as const) emit(`can-${look}`, `can ${look}`, buildCanFrame(look))

// contact sheet of everything above
{
  const args = ['montage']
  for (const l of labeled) args.push('-label', l.label, l.file)
  args.push('-tile', '5x', '-geometry', '+10+10', '-background', '#14161b', '-fill', '#d8d8d8', '-font', FONT, '-pointsize', '18', join(out, 'all-states.png'))
  execFileSync('magick', args)
}

// round-3 sheets: the intro per body, every delight-event frame (round), and the idle micro layers
sheet('intro-sheet', ['round', 'skinny', 'bloated', 'asleep'].flatMap(s =>
  Array.from({ length: INTRO_FRAMES }, (_, k): [string, string[]] => [`${s} intro ${k}`, buildFrame(s as StateId, 0, { intro: k })])), 6, 6)
sheet('delight-sheet', EVENT_NAMES.flatMap(e =>
  Array.from({ length: EVENTS[e].frames }, (_, k): [string, string[]] => [`${e} ${k}`, buildEventFrame('round', e, k)])), 8, 5)
sheet('micro-sheet', AWAKE.flatMap(s => [
  [`${s} idle`, buildFrame(s, 0)],
  [`${s} blink + ear`, buildFrame(s, 0, { blink: true, ear: true })],
  [`${s} tail 1`, buildFrame(s, 0, { tail: 1 })],
  [`${s} tail 2`, buildFrame(s, 0, { tail: 2 })],
  ...Array.from({ length: JIGGLE_FRAMES }, (_, k): [string, string[]] => [`${s} jiggle ${k}`, buildFrame(s, 0, { jiggle: k })]),
] as Array<[string, string[]]>), 8, 5)

// hero: the six body states side by side, large
{
  const HERO: Array<[StateId, number, string]> = [
    ['skinny', 0, 'skinny  <10%'],
    ['snacking', 1, 'snacking  10-35%'],
    ['round', 0, 'round  35-60%'],
    ['huge', 2, 'huge  60-80%'],
    ['bloated', 3, 'bloated  80-99%'],
    ['coma', 3, 'coma  100%'],
  ]
  const args = ['montage']
  for (const [s, f, label] of HERO) args.push('-label', label, png(`hero-${s}`, buildFrame(s, f, { shimmer: 1 }), 16, tmp))
  args.push('-tile', '3x2', '-geometry', '+16+16', '-background', '#14161b', '-fill', '#e6e0d6', '-font', FONT, '-pointsize', '34', join(out, 'hero-progression.png'))
  execFileSync('magick', args)
}

// ---- animated GIFs ---------------------------------------------------------
type Shot = { rows: string[]; ms: number }
function gif(name: string, shots: Shot[], scale = SCALE) {
  const merged: Shot[] = []
  for (const s of shots) {
    const last = merged[merged.length - 1]
    if (last && last.rows.join('') === s.rows.join('')) last.ms += s.ms
    else merged.push({ rows: s.rows, ms: s.ms })
  }
  const args: string[] = []
  merged.forEach((s, i) => {
    const p = join(tmp, `${name}-${i}.ppm`)
    ppm(s.rows, p)
    args.push('-delay', `${Math.max(2, Math.round(s.ms / 10))}`, p)
  })
  const dst = join(out, `${name}.gif`)
  execFileSync('magick', [...args, '-filter', 'point', '-scale', `${scale * 100}%`, '-loop', '0', '-layers', 'Optimize', dst])
  const total = merged.reduce((a, s) => a + s.ms, 0)
  console.log(`${name}.gif: ${merged.length} frames, ${(total / 1000).toFixed(1)} s, ${(statSync(dst).size / 1024).toFixed(0)} KB`)
}
function run(ms: number, f: (now: number) => string[], t0 = 0): Shot[] {
  const shots: Shot[] = []
  for (let t = 0; t < ms; t += TICK_MS) shots.push({ rows: f(t0 + t), ms: TICK_MS })
  return shots
}

/**
 * Idle with the micro layers scripted so a short clip shows them (live, core.microState
 * fires them on a seeded 3-21 s schedule): ear twitch, blink, then a tail swish.
 */
function idleShow(state: StateId, ms: number, t0 = 0): Shot[] {
  return run(ms, now => {
    const t = now - t0
    const step = Math.floor(now / 250)
    const seq = SEQUENCE[state]
    const ex: Extras = { shimmer: step }
    if (state !== 'coma' && state !== 'asleep' && state !== 'workout') {
      if (t >= ms * 0.15 && t < ms * 0.15 + 250) ex.ear = true
      if (t >= ms * 0.4 && t < ms * 0.4 + 250) ex.blink = true
      if (t >= ms * 0.6 && t < ms * 0.6 + 750) ex.tail = Math.floor((t - ms * 0.6) / 250) % 2 ? 2 : 1
    }
    return buildFrame(state, seq[step % seq.length]!, ex)
  }, t0)
}
/** A delight event played over `ms` (default its own length), frames uniform like render.ts. */
function event(state: StateId, e: EventName, ms = EVENTS[e].ms, from = 0, to = EVENTS[e].frames): Shot[] {
  const n = to - from
  return run(ms, now => buildEventFrame(state, e, from + Math.min(n - 1, Math.floor((now / ms) * n))))
}
function intro(state: StateId): Shot[] {
  return run(INTRO_MS, now => bandFrame({ state, now, isWorking: false, introStart: 0 }).rows)
}

gif('tonk-eating', [
  ...run(2000, now => onBand(chompFrame(now))),
  ...run(2600, now => bandFrame({ state: 'round', now, isWorking: false, burst: { start: 0, n: 8 } }).rows),
  ...run(2700, now => bandFrame({ state: 'round', now, isWorking: true }).rows),
])

const PROG: Array<[StateId, number]> = [['skinny', 3000], ['snacking', 2250], ['round', 2250], ['huge', 2250], ['bloated', 2250], ['coma', 2000]]
gif('tonk-progression', PROG.flatMap(([state, ms]) => idleShow(state, ms)))

gif('tonk-poke', [
  ...run(4000, now => bandFrame({ state: 'skinny', now, isWorking: false, idleMs: BORED_MS }).rows),
  ...run(2250, now => bandFrame({ state: 'round', now, isWorking: false, idleMs: FRANTIC_MS }).rows),
  ...run(2250, now => bandFrame({ state: 'huge', now, isWorking: false, idleMs: BANG_MS }).rows),
])

gif('tonk-intro', [
  ...run(500, () => buildCanFrame('upright')),
  ...intro('skinny'),
  ...idleShow('skinny', 1250),
  ...run(500, () => buildCanFrame('upright')),
  ...intro('round'),
  ...idleShow('round', 1250),
  ...run(500, () => buildCanFrame('upright')),
  ...intro('asleep'),
  ...idleShow('asleep', 1250),
])

gif('tonk-delight', EVENT_NAMES.flatMap(e => [...idleShow('round', 500), ...event('round', e)]))

// ---- the hero: an X-post showcase, captioned with a pixel font -----------
const FONT5: Record<string, string[]> = {
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  O: ['###', '#.#', '#.#', '#.#', '###'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  W: ['#...#', '#...#', '#.#.#', '#.#.#', '.#.#.'],
  E: ['###', '#..', '##.', '#..', '###'],
  L: ['#..', '#..', '#..', '#..', '###'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  '%': ['##..#', '##.#.', '..#..', '.#.##', '#..##'],
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '.##', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
  ' ': ['..', '..', '..', '..', '..'],
}
function textW(s: string) {
  return [...s].reduce((a, ch) => a + (FONT5[ch]?.[0]!.length ?? 2) + 1, -1)
}
function text(px: string[][], x: number, y: number, s: string, c: string, shadow?: string) {
  for (const ch of s) {
    const g = FONT5[ch] ?? FONT5[' ']!
    g.forEach((row, dy) => {
      for (let dx = 0; dx < row.length; dx++)
        if (row[dx] === '#') {
          if (shadow && px[y + dy + 1]) px[y + dy + 1]![x + dx + 1] = shadow
          px[y + dy]![x + dx] = c
        }
    })
    x += g[0]!.length + 1
  }
}
const HW = 52
const HH = 32
/**
 * The band framed on a 52 x 32 canvas: the floor under Tonk IS the weekly meter
 * (a full-width bar that fills as he eats), with TONK and the percent below it.
 */
function framed(rows: string[], pct: number): string[] {
  const px = Array.from({ length: HH }, () => Array<string>(HW).fill('.'))
  rows.forEach((r, y) => {
    for (let x = 0; x < W; x++) if (r[x] !== '.') px[y + 2]![x + 4] = r[x]!
  })
  const bx0 = 2
  const bx1 = HW - 3
  const fill = Math.round(((bx1 - bx0 + 1) * Math.min(100, Math.max(0, pct))) / 100)
  for (let x = bx0; x <= bx1; x++) {
    const on = x - bx0 < fill
    px[22]![x] = on ? 'y' : 'T'
    px[23]![x] = on ? 'o' : '#'
  }
  text(px, 4, 25, 'TONK', 'r', 'R')
  const label = `${Math.round(pct)}%`
  text(px, HW - 4 - textW(label), 25, label, 'w', '#')
  return px.map(r => r.join(''))
}
function captioned(shots: Shot[], pct: number | ((i: number, n: number) => number)): Shot[] {
  return shots.map((s, i) => ({ rows: framed(s.rows, typeof pct === 'number' ? pct : pct(i, shots.length)), ms: s.ms }))
}
const burst = { start: 0, n: 6 }
/** A growth beat: the new, bigger body lands with a belly jiggle (squash, stretch, squash, settle). */
function grow(state: StateId): Shot[] {
  return Array.from({ length: JIGGLE_FRAMES }, (_, k) => ({ rows: buildFrame(state, 0, { jiggle: k, shimmer: k }), ms: TICK_MS }))
}
gif('tonk-hero', [
  ...captioned(run(375, () => buildCanFrame('upright')), 0),
  ...captioned(intro('skinny'), 2),
  ...captioned(run(875, now => bandFrame({ state: 'skinny', now, isWorking: true }).rows), (i, n) => 2 + (8 * i) / n),
  ...captioned(grow('snacking'), 12),
  ...captioned(run(2500, now => bandFrame({ state: 'snacking', now, isWorking: false, burst }).rows), (i, n) => 12 + (22 * i) / n),
  ...captioned(grow('round'), 38),
  ...captioned(event('round', 'golden', 1875), (i, n) => 38 + (17 * i) / n),
  ...captioned(grow('huge'), 64),
  ...captioned(event('huge', 'sneeze', 1000), (i, n) => 64 + (12 * i) / n),
  ...captioned(grow('bloated'), 84),
  ...captioned(idleShow('bloated', 1000, 1000), (i, n) => 84 + (14 * i) / n),
  ...captioned(run(1500, now => bandFrame({ state: 'coma', now, isWorking: false }).rows), 100),
  // the weekly reset: jumping jacks while the bar drains, then the loop starts over
  ...captioned(run(1500, now => bandFrame({ state: 'workout', now, isWorking: false }).rows), (i, n) => 100 * (1 - i / (n - 1))),
], 16)

rmSync(tmp, { recursive: true, force: true })
console.log(`wrote ${labeled.length} frames, 4 sheets, hero-progression.png and 6 GIFs to ${out}`)
