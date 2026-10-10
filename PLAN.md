# Tonk build plan (art and dev in parallel)

Status 2026-10-10: scaffold, logic, first-pass art, 34 tests green (`claude plugin test .`), `tsc -p .` clean,
`claude plugin validate .` passes. Nothing installed into any live Claude Code config.

## Ownership (no collisions)

| Owner | Files | Never touches |
|---|---|---|
| Art agent | `hooks/sprites.ts` (may split into `hooks/sprites/*.ts`; keep `hooks/sprites.ts` as the re-export index), `previews/*`, `scripts/preview.ts` | `core.ts`, `render.ts`, `register.tsx`, `tests/` |
| Dev agent | `hooks/core.ts`, `hooks/render.ts`, `hooks/register.tsx`, `tests/*`, `statusline/`, README | `sprites.ts` internals |

The seam is the exports below. Change a signature only by editing this file first.

## Layout

```
.claude-plugin/plugin.json   manifest (name tonk, v0.1.0, MIT)
hooks/hooks.json             { "modules": ["./register.tsx"] }
hooks/register.tsx           engine hooks: session.start/measure, turn.start/complete, ui.render Spinner + AbovePrompt
hooks/core.ts                pure logic: state pick, reset detect, captions, pellet counts, pellet motion
hooks/render.ts              (state, time, activity) -> pixel rows: bandFrame(), chompFrame()
hooks/sprites.ts             ALL pixel art + palette + Raster encoding
tests/core.test.ts           logic + sprite sanity   tests/mod.test.ts  mounted-UI tests
scripts/preview.ts           node scripts/preview.ts -> previews/*.png + all-states.png (12x, nearest)
statusline/                  (todo) tonk-statusline.sh fallback
```

## Sprite data format

A frame is `string[]`: one string per pixel row, one char per pixel, `'.'` = transparent. Band frames are
**W=44 x H=20** px (H even: two pixel rows pack into one terminal row with half blocks, so 44 cols x 10 rows).
Spinner chomper is **30 x 6** px (30 cols x 3 rows). Palette char -> 0xRRGGBB lives in `PALETTE` (sprites.ts):

`k` outline 0e0c0d, `m` mask 1d1a1e, `g` fur 8c7f70, `h` light fur b9ab98, `d` dark fur 5d5348, `w` cream eee6d6,
`e` eye f3d247, `p` pink c0716a, `r` bandana d02b2b, `R` bandana shade 8f1d1d, `o` pellet ff9d1c, `y` pellet glow ffe27a,
`O` dark orange b85c00, `t` can 6d727c, `T` can dark 3a3d45, `q` can rim a3a9b4, `u` rust 8f4f2c, `n` belt 6a4220,
`Y` buckle e8c23a, `s` sweat 6ec6ff, `a` sweat shine dff4ff, `c` burp puff e8e8ee, `Z` zzz 9fb4ff.
New chars are fine (add to `PALETTE`; keep a single character; `'.'` and a space are reserved). Chars in
`NO_OUTLINE` (o y Z c s a) are not auto-outlined; everything else gets a 1 px `k` outline from `Grid.outline()`.
Terminal limit: 1024 distinct fg/bg pairs per Raster, so keep the palette near 25 colors.

Art is currently procedural (shape calls plus a hand-drawn 13x10 head literal `HEAD`, eye/mouth overlays `EYES`/`MOUTHS`).
The art agent may replace any of it with literal grids, as long as the exports below keep their shapes.

## Frame list (state x frames), band 44 x 20

| State (weekly %) | Frames | Idle loop `SEQUENCE` (one step = 250 ms) | Content |
|---|---|---|---|
| asleep (no data) | 2 | 0,0,1,1 | skinny body, eyes shut, Z floats, empty can |
| skinny (<10) | 3 | 0,0,0,1,0,0,2,2,0,0 | ribs, wide hungry eyes, stare / blink / tail flick + tongue |
| snacking (10-35) | 4 | 0,0,1,2,3,2,3 | reach into can / paw to mouth with pellet / chew0 / chew1 |
| round (35-60) | 3 | 0,1,2,2,1 | happy munch, pellet in both paws shrinking |
| huge (60-80) | 3 | 0,0,1,1,2,2 | belt and bandana straining, sweat drop falls (3 heights), blink |
| bloated (80-99) | 4 | 0,1,0,1,2,3,3 | belly breath, burp O, small puff, big puff |
| coma (100) | 4 | 0,1,2,3 | on back, paws up, tongue out, Z, Z Z, Z Z Z, belly breath |
| workout (reset, 6 s) | 2 | 0,1 | jumping jacks (arms up, legs apart, jump 2 px) |
| chomp (Spinner, 30 x 6) | live | n/a | mini can, mini head, 3 pellets arcing in, mouth open/closed |

Pellet pile on the floor shrinks with the state (`PILE`: 0, 9, 7, 5, 3, 2, 1, 6 pellets). Eating overlays reuse an
`EAT_FRAME` (a frame with empty paws) and replace the mouth with `open` / `chew0` / `chew1`, drawing flying pellets on top.

### New, requested 2026-10-10 00:41 (not built yet): idle impatience

After no turn activity: >= 2 min **bored poke** (grabs a stick, pokes the can slowly), >= 5 min **frantic poke**,
>= 10 min **bangs the can** (can shakes, pellets jump). Needs, per body state that can move (skinny..bloated; coma and
asleep stay asleep): a stick prop, 2-3 frames per tier, can-shake offsets. Proposed export (art):
`buildFrame(state, frame, { poke?: 'bored' | 'frantic' | 'bang' })`, `POKE_FRAMES: Record<'bored'|'frantic'|'bang', number>`.
Dev side: `render.ts` picks the tier from `now - lastActivity` (core.ts gets `pokeTier(idleMs)`, tests at 2/5/10 min boundaries).

## Interfaces

### sprites.ts exports (art owns, dev reads)
```ts
export const W = 44, H = 20, CHOMP_W = 30, CHOMP_H = 6
export const PALETTE: Record<string, number>
export const FRAME_COUNT: Record<StateId, number>
export const SEQUENCE: Record<StateId, number[]>          // idle loop, indexes into frames
export const EAT_FRAME: Record<StateId, number>           // frame with empty paws for eating overlays
export const MOUTH: Record<StateId, {x:number;y:number}>  // mouth pixel, where pellets are aimed
export const CAN_MOUTH: {x:number;y:number}               // where streamed pellets start
export const CHOMP_MOUTH, CHOMP_CAN: {x:number;y:number}
export type Mouth = 'grin'|'chew0'|'chew1'|'open'|'burp'|'tongue'
export type Extras = { pellets?: {x:number;y:number}[]; mouth?: Mouth; pileOverride?: number }
export function buildFrame(state: StateId, frame: number, extras?: Extras): string[]   // W x H rows
export function buildChomp(open: boolean, pellets: {x:number;y:number}[]): string[]    // 30 x 6 rows
export function toRasterCells(rows: string[]): { columns: number; rows: number; cells: string } // RasterProps
export function toCellGrid(rows: string[]): Cell[][]       // half-block cells, used by the terminal demo
```
Invariants the tests enforce: every frame is exactly W x H, only `PALETTE` chars or `.`, and frames within a state differ.
`StateId = 'asleep'|'skinny'|'snacking'|'round'|'huge'|'bloated'|'coma'|'workout'` is defined in `core.ts` (dev owns; add a
state there first, then art adds its frames).

### ART ADDITIONS (art agent, 2026-10-10)

Art pass 2 is in `hooks/sprites.ts` (one file, no split). All PLAN exports keep their shapes; additions and changed values:

| What | Detail |
|---|---|
| `POKE_FRAMES` | `{ bored: 8, frantic: 3, bang: 3 }`: loop lengths in 250 ms idle steps, so `idleStep(now) % count` in render.ts is right as is |
| `POKE_SEQUENCE` | `Record<PokeTier, number[]>`: step -> pose. bored has 2 poses held 4 steps each (lazy, 1 s per poke); frantic 3 poses; bang 3 (stick up / slam with the can jolted and a "!" pop / rebound with a pellet hopping out) |
| `buildFrame(state, frame, { poke })` | `Extras.poke?: PokeTier` (type imported from core.ts and re-exported). Drawn for skinny, snacking, round, huge, bloated with their own body sizes; asleep/coma/workout ignore `poke` and draw the idle frame. Poke frames draw an empty floor (no pellet pile) |
| `Mouth` | gains `'flat'` and `'grit'` (used by poke faces); the original six are unchanged. `Eyes` is exported too |
| Head | now 13 x 10 (was 13-wide literal + overlays); `HEAD_X` 20 -> 21 |
| `MOUTH` values | asleep/skinny/workout {27,9}, snacking/round {27,8}, huge {27,9}, bloated {27,10}, coma {36,13} |
| Chomper | still **30 x 6** (test unchanged): head-only front view, mask + shiny eyes + mouth that opens. `CHOMP_MOUTH` {23,5}, `CHOMP_CAN` {4,1} (chosen so `streamFrame`'s lift keeps the arc on screen) |
| `PALETTE` | + `b` stick highlight (24 colors) |
| `scripts/preview.ts` | also writes `previews/hero-progression.png` (6 bodies, 3x2, 16x), `poke-*.png`, and `tonk-eating.gif`, `tonk-progression.gif`, `tonk-poke.gif` at real timing via `render.ts` (read-only import of `bandFrame`/`chompFrame`) |

No test needed changing; 47/47 green, `tsc -p .` clean.

### ART ADDITIONS (round 3) (art agent, 2026-10-10 01:30; names and shapes final, drawing in progress)

Shapes match what render.ts already probes through `ArtApi` (extras on `buildFrame`, uniform frame timing). Every new
extra is optional; absent means today's behavior.

```ts
// can intro: upright lidded can, Tonk (current body) reaches over, yanks it down, lid clatters onto the fallen can,
// pellets spill to the state's pile, satisfied grin. Frames are uniform over core INTRO_MS (2600 ms => ~217 ms each);
// holds are baked in as repeated poses. The LAST intro frame equals the idle frame 0 floor (lid now rests on the can).
export const INTRO_FRAMES = 12                      // buildFrame(state, 0, { intro: k }), k in 0..11
export const UPRIGHT_CAN: readonly string[]         // the upright, lidded can literal (art only)
export function buildCanFrame(look: 'upright' | 'tipped' | 'drained'): string[]   // W x H, can and floor only
export const DRAINED_CAN = true                     // buildFrame(state, f, { drained: true }): dark empty can, crumbs, no glow
// belly jiggle after a burst lands (squash, stretch, squash, settle); works with or without mouth/pellets extras
export const JIGGLE_FRAMES = 4                      // buildFrame(state, f, { jiggle: k }), k in 0..3
// idle micro layers, driven by core.microState(now); work on any frame of skinny..bloated (asleep: tail/ear only)
//   { blink?: boolean; tail?: 0 | 1 | 2; ear?: boolean; shimmer?: number }
//   shimmer: pass idleStep(now); it cycles the pile's o/y glow. Absent => derived from the frame index.
//   The huge sweat drip is baked into the huge idle frames (FRAME_COUNT.huge grows, SEQUENCE updated).
// random delight events, one-shot; ids identical to core.EventId
export type EventName = 'wash' | 'treasure' | 'lid_hat' | 'juggle' | 'sneeze' | 'look_up' | 'golden' | 'doze' | 'bandana_cape'
export const EVENTS: Record<EventName, { frames: number; ms: number }>   // ms == core EVENT_MS; frames uniform over ms
export function buildEventFrame(state: StateId, event: EventName, frame: number): string[]   // W x H; any state
//   skinny draws its own body where cheap; snacking/huge/bloated reuse the round pose at their own size where noted;
//   asleep/coma/workout fall back to the idle frame 0 (render.ts gates them out anyway).
```

Built (2026-10-10 01:55). Also exported: `EVENT_NAMES` (array, same order as the type), `HEAD_POS` (head top-left per
state), `CAN`, `CAN_DRAINED`, `PILE`, `Eyes`/`Brow` types. Files: `hooks/sprites/base.ts` (palette, Grid, head, bodies,
props), `hooks/sprites/intro.ts`, `hooks/sprites/events.ts`; `hooks/sprites.ts` stays the index (buildFrame, pokes,
chomper, encoding). Changed values the dev may care about:

| What | Detail |
|---|---|
| `MOUTH` | now head x + 6, head y + 8: asleep/skinny {21,13} (hunched, head forward and low), snacking/round/huge/workout {27,9}, bloated {27,10}, coma {36,13} |
| Head height | every head sits at y >= 1, so its outline never clips the top edge (snacking/round moved down 1) |
| `FRAME_COUNT.huge` 3 -> 8, `SEQUENCE.huge` = 0..7 | the sweat drip is baked in (forms at the temple, rolls, drops, splats, 2 dry beats); `EAT_FRAME.huge` 0 -> 6 (a dry beat) |
| `SEQUENCE.skinny` | 12 steps: stare, a forward hungry lean (frame 2), a tongue lick with a tail flick (frame 1); blinks now come from the `blink` extra |
| `PALETTE` | + `W` (snaggle tooth / star white, never outlined). 25 colors |
| Can | after the intro the lid rests on the fallen can in every frame (poke, events, idle). Coma and asleep default to `drained` (pass `drained: false` to override) |
| Pile | drawn behind Tonk now, so his silhouette stays clean; pokes still draw an empty floor |
| Shimmer | render.ts only passes `shimmer` when a micro layer is active; passing `idleStep(now)` on every idle frame makes the pile twinkle continuously (optional) |
| Intro bodies | asleep tips the drained can (nothing comes out, he sleepwalks); coma/workout map to bloated/skinny if ever asked |
| `scripts/preview.ts` | also writes `intro-sheet.png`, `delight-sheet.png`, `micro-sheet.png`, `can-*.png`, and `tonk-intro.gif`, `tonk-delight.gif`, `tonk-hero.gif` (52 x 30 captioned canvas, 16x) |

No test needed changing; `claude plugin test .` green and `tsc -p .` clean at this commit.

### ART ADDITIONS (round 4, polish) (art agent, 2026-10-10)

No export names or shapes changed; render.ts and core.ts untouched; no ART REQUESTS. Changed values:

| What | Detail |
|---|---|
| Face (all bodies, events, intro, pokes, chomper) | Was reading as a skull. Now: charcoal mask band that tapers to the cheeks, bead eyes with a shine, cream brows, a warm light muzzle (not white), a dark nose pad, cheek-fluff tufts 1 px past each jaw, and a CLOSED smirk with ONE snaggle tooth. Mouths open only for eating, gasp, burp, sneeze, bleh, bang; open interiors are red-brown `j` with at most the one tooth |
| `PALETTE` | `m` 1d1a1e -> **3a3236** (mask, tail tips, cape edge, drained-can inside). New: `N` 2b2024 nose pad, `l` d6c8b2 muzzle, `j` 6b2c2a open-mouth interior. 28 colors |
| `Eyes` | same names; `wide` is now whites with pupils low (was glowing yellow), `normal` a bead with a shine. Bang pokes use `annoyed` eyes |
| Intro tilt frames 4-6 | hand-drawn literals (4:1, 2:1, 1:2 staircases) instead of runtime rotation; same frame count and timing |
| Events | juggle: 2 pellets in a small one-paw loop beside the head (no arm across the chest), bonk kept. treasure: 2x2 bright cap with a shine rides the bandana for frames 7-9. doze: two 2 px nods (sink, jerk up, sink). wash scrub arms un-outlined |
| Micro | `ear: true` perks the right ear up and out 2 px (reads at 1x). Skinny jiggle ticks only on the right (the left one hit the face) |
| `scripts/preview.ts` | `tonk-hero.gif` is 52 x 32: the floor under Tonk is a full-width weekly meter, TONK and the percent below; belly-jiggle growth beats between bodies; ends on the workout reset with the meter draining so the loop closes |

`claude plugin test .` 79/79 and `tsc -p .` clean at this commit.

### ART PASS 5: front-facing chibi redesign (art agent, 2026-10-10)

From `design/proto.py`. No export names or shapes changed; render.ts and core.ts untouched. Changed values:

| What | Detail |
|---|---|
| Character | Front-facing sitting raccoon: 16 x 12 head (outline baked in), body ellipse whose width is the meter (rx 4 / 5.5 / 7 / 9 / 11.5), ringed tail behind the right hip. Skinny keeps the normal head and ears and sits 1 px lower (a slight hunch) on the thin body; huge wears the belt; bloated has the popped belt and sweat; coma is slumped with closed eyes and tongue out beside the drained can |
| `PALETTE` | `m` 2c2629, `g` 9a9184, `h` c9bfae, `w` f2ece0, `W` ffffff, `N` 1a1416, `p` e0868a. Dropped `e` and `l`. `k` joined `NO_OUTLINE` (baked outlines never double) |
| `HEAD_X` 21, `HEAD_W` 16 | `HEAD_POS` y: skinny/workout 1, asleep 2, coma 3, the rest 0 |
| `MOUTH` | head x + 8, head y + 12: the pellet's centre held in both paws just under the lips |
| `CAN_MOUTH` | {9, 13} (was {10, 14}) |
| Eating pellets | `buildFrame` redraws every stream/burst pellet on its own path (hop out of the can, level slide into the paws at mouth height); progress = distance to the mouth, so render.ts timing is unchanged. Nothing crosses the face above the nose row (checked over 1290 eating frames). Asleep/coma bursts rain onto the pile |
| Chomper | 13-wide head: ears, brows, mask with glints, nose, mouth that opens red; pellets slide in level with the mouth. `CHOMP_MOUTH` {22, 5} |
| `scripts/preview.ts` | never deletes `tonk-live-terminal.gif` / `live-spinner.png`; the hero title's N is 5 px wide and TONK has 2 px letter spacing |

### core.ts exports (dev owns, art reads)
`StateId`, `pickState`, `findWindow`, `detectReset`, `makeCaption`, `compactLine`, `pelletsForTurn`, `pelletsForTokens`,
`burstFrame` (pellet positions for a burst), `streamFrame` (live-eating arc), `TICK_MS` (125), `idleStep`.

### render.ts (dev owns)
`bandFrame({ state, now, isWorking, burst }) -> { rows, mode }` and `chompFrame(now) -> rows`. It only calls `buildFrame`,
`buildChomp`, `SEQUENCE`, `EAT_FRAME`, `MOUTH`, `CAN_MOUTH`, `CHOMP_*`.

## Behavior (all implemented except the idle pokes)

- Belly size follows the weekly `seven_day` percent. Boundaries: 10, 35, 60, 80, 100.
- Live eating: Spinner site is replaced by the chomper plus the engine's word (this drops the engine's elapsed/token/effort
  text on that row; see facts). The band Tonk also eats while a turn runs.
- Pellet burst at `turn.complete`: n pellets fall into the band and are gobbled over 1 to 1.8 s.
  n = ceil(tokens / 2000) capped at 12, tokens = input + output + cache_creation (cache reads excluded).
  Fallback order (Treynor 2026-10-10 00:38): per-turn tokens, then the 5-hour percent delta, then the weekly percent delta,
  then 1 pellet. Delta fallbacks use 1 pellet per 0.5 percentage points. The source used is written to the mod store as `lastPellets`.
- Reset: weekly percent drops >= 20 points versus the stored value (or the window rolls forward with a lower percent):
  6 s workout, then skinny. Stored in the mod store key `last` (tiny, far under 4 MiB).
- No usage data: asleep, "no snacks yet". Narrow terminals (< 46 cols) or short bands get a one-line text.
- Does not touch the transcript or Claude's output text; draws only in `AbovePrompt` and the `Spinner` row.

## Verified API facts (docs and the generated types file, Claude Code 2.1.294)

| Fact | Evidence | Label |
|---|---|---|
| `$.session.usage().rateLimits` and `session.measure.rateLimits` are `{ kind, percentUsed, resetsAt? }[]`; `kind` is `five_hour`, `seven_day`, or a gateway's `spend_limit` (types doc comment on `SessionRateLimit`). `percentUsed` is 0 to 100, one decimal. Empty off a subscription or before the first reading. | `.claude-plugin/types/claude-code/index.d.ts` | type-check-only (not yet read from a live session) |
| Spinner is replaceable: `ui.render` on `{ component: 'Spinner' }` may draw a tree "in place of all of it" (props: `word`, `message`, `suffix`, `mode`). Terminal and desktop only. | types doc; mounted in `tests/mod.test.ts`; `claude plugin validate` | test-verified |
| `AbovePrompt` band: props `hasSurvey`, `isWorking`, `maxRows`, `bodyColumns`; terminal and desktop only. `Raster` exists on the terminal surface only. | types doc; mounted in tests | test-verified |
| Per-turn tokens exist: `turn.complete` input carries `usage?: { input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens, model }` summed over the turn's requests; absent on interrupt or API error. `$.session.usage().context.tokens` is the context fill, not a per-turn delta. | types: `TurnCompleteFields`, `TurnUsage`, `ModelUsage` | type-check-only |
| Animation: `$.clock.every(ms, fn)` + `$.ui.invalidate('ui.render')`, max about 30 redraws per second in the terminal; the mod runs 8 fps animating, 4 fps idle. `$.ui.blit` can repaint a Raster without a render pass (not used). | types doc | type-check-only |
| Mod store: `$.store.get/set`, JSON, 4 MiB cap. | types doc | type-check-only |

## Doc mismatches found
- Task said "use `claude plugin init` to scaffold". In 2.1.294 `claude plugin init` scaffolds a command-hooks plugin under
  `~/.claude/skills/<name>`, not a mod. The bundled plugin-authoring skill says to write the three mod files directly. Done that way.
- `claude plugin validate` only accepts `$` passed to top-level function declarations, so shared state lives in a module-level object.
- `claude plugin test` has no `$.store` noun on the test `$`; tests capture `store.set` through hooks instead.

## Next steps
1. Art agent: polish frames against `memory/reference/artifacts/2026-10-10-tonk/tonk-d.png`; add idle-poke frames.
2. Dev agent: `pokeTier`, idle timer in `register.tsx`, statusline fallback script, `previews/terminal-demo.txt` generator, README, live probe of `kind` strings.
