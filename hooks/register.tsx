import type { EngineInterface, Register } from 'claude-code'

import {
  FIVE_HOUR_KIND, TICK_MS, WEEKLY_KIND,
  GOLDEN_QUIP, INTRO_QUIP, eventSeed, POKE_QUIPS, activeTier, canIntro, introProgress, compactLine, detectReset, findWindow, makeCaption, pelletsForTurn, pickState,
  type Burst, type StateId, type Window,
} from './core.ts'
import { bandFrame, chompFrame } from './render.ts'
import { CHOMP_H, H, toRasterCells } from './sprites.ts'

const WORKOUT_MS = 6000
const BAND_MIN_COLUMNS = 46
const SIDE_BY_SIDE_COLUMNS = 82
const STORE_KEY = 'last'
const ACTIVITY_KEY = 'lastActivity'

const ORANGE = '#ff9d1c'
const RED = '#e04a3a'

type Last = { percent: number; resetsAt?: string; at: number }

type Limits = Array<{ kind: string; percentUsed: number; resetsAt?: string }>

// Module variables are only animation state; a hot reload resets them harmlessly.
const S: {
  weekly: Window | undefined
  five: Window | undefined
  workoutUntil: number
  burst: Burst | null
  isWorking: boolean
  lastTurnFive: number | undefined
  lastTurnWeekly: number | undefined
  hasLoaded: boolean
  lastActivity: number
  /** The can-tip intro is owed (new session, or a reset workout just ended). */
  eventSeed: number
  introPending: boolean
  /** When the intro began; null when not playing. */
  introStart: number | null
} = {
  weekly: undefined,
  five: undefined,
  workoutUntil: 0,
  burst: null,
  isWorking: false,
  lastTurnFive: undefined,
  lastTurnWeekly: undefined,
  hasLoaded: false,
  lastActivity: 0,
  introPending: false,
  eventSeed: 0,
  introStart: null,
}

async function onUsage($: EngineInterface, limits: Limits) {
  const nextWeekly = findWindow(limits, WEEKLY_KIND)
  S.five = findWindow(limits, FIVE_HOUR_KIND)
  S.weekly = nextWeekly
  if (!nextWeekly) return
  const now = await $.clock.now()
  const prev = (await $.store.get(STORE_KEY)) as Last | undefined
  if (detectReset(prev ?? undefined, nextWeekly)) S.workoutUntil = now + WORKOUT_MS
  if (!prev || prev.percent !== nextWeekly.percent || prev.resetsAt !== nextWeekly.resetsAt) {
    const value: Last = { percent: nextWeekly.percent, resetsAt: nextWeekly.resetsAt, at: now }
    await $.store.set(STORE_KEY, value)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    try {
      const usage = await $.session.usage()
      await onUsage($, usage.rateLimits)
      S.lastTurnFive = S.five?.percent
      S.lastTurnWeekly = S.weekly?.percent
    } catch {
      // no reading yet: Tonk sleeps until the first response
    }
    S.lastActivity = await $.clock.now()
    await $.store.set(ACTIVITY_KEY, S.lastActivity)
    S.hasLoaded = true
    S.introPending = true
    S.introStart = null
    S.eventSeed = eventSeed((e as { sessionId?: string }).sessionId, S.lastActivity)
    let tick = 0
    $.clock.every(TICK_MS, () => {
      tick++
      // 8 fps while something is eating or exercising, 4 fps when only idling
      if (S.isWorking || S.burst !== null || S.workoutUntil > 0 || S.introStart !== null || tick % 2 === 0) $.ui.invalidate('ui.render')
    })
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await onUsage($, e.rateLimits)
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    S.isWorking = true
    // A turn skips the intro gracefully: the chomp takes over and the intro is not owed again.
    S.introPending = false
    S.introStart = null
    S.lastActivity = await $.clock.now()
    await $.store.set(ACTIVITY_KEY, S.lastActivity)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    S.isWorking = false
    if (e.agentId === undefined) {
      const now = await $.clock.now()
      S.lastActivity = now
      await $.store.set(ACTIVITY_KEY, now)
      const dFive = S.five && S.lastTurnFive !== undefined ? S.five.percent - S.lastTurnFive : undefined
      const dWeekly = S.weekly && S.lastTurnWeekly !== undefined ? S.weekly.percent - S.lastTurnWeekly : undefined
      const { n, source } = pelletsForTurn(e.usage, dFive, dWeekly)
      const pending = S.burst && now - S.burst.start < 1500 ? S.burst.n : 0
      S.burst = { start: now, n: Math.min(12, n + pending) }
      S.lastTurnFive = S.five?.percent
      S.lastTurnWeekly = S.weekly?.percent
      await $.store.set('lastPellets', { source, n, at: now })
    }
    return next(e)
  })

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)
    const { Box, Text, Raster } = $.ui.resolve(e)
    const now = await $.clock.now()
    const { columns, rows, cells } = toRasterCells(chompFrame(now))
    return (
      <Box flexDirection="row" gap={1}>
        <Raster key="tonk-chomp" columns={columns} rows={rows} cells={cells} />
        <Box flexDirection="column" justifyContent="flex-end" height={CHOMP_H / 2}>
          <Text color={ORANGE}>
            {e.props.message ?? e.props.word}
            {e.props.suffix}
          </Text>
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !S.hasLoaded) return next(e)
    const now = await $.clock.now()
    if (S.workoutUntil > 0 && now >= S.workoutUntil) {
      S.workoutUntil = 0
      S.introPending = true // the can is set upright again after the workout
    }
    if (S.burst && now - S.burst.start > 4000) S.burst = null
    const state: StateId = S.workoutUntil > 0 ? 'workout' : pickState(S.weekly?.percent)
    const working = e.props.isWorking || S.isWorking
    if (S.introStart !== null && introProgress(S.introStart, now) === null) S.introStart = null
    if (S.introPending && !working && S.burst === null && S.workoutUntil === 0) {
      S.introPending = false
      if (canIntro(state)) S.introStart = now
    }
    const caption = makeCaption(state, S.weekly, S.five, now)
    const idleMs = now - S.lastActivity
    const tier = activeTier(state, idleMs, e.props.isWorking || S.isWorking)
    if (tier) caption.sub = POKE_QUIPS[tier]
    if (S.introStart !== null && canIntro(state)) caption.sub = INTRO_QUIP
    const columns = e.props.bodyColumns
    const isTall = e.props.maxRows >= H / 2 + 1

    if (e.surface !== 'terminal' || columns < BAND_MIN_COLUMNS || !isTall) {
      const { Text } = $.ui.resolve(e)
      return (
        <Text color={ORANGE} wrap="truncate">
          {compactLine(caption)}
        </Text>
      )
    }

    const { Box, Text, Raster } = $.ui.resolve(e)
    const frame = bandFrame({ state, now, isWorking: working, burst: S.burst, idleMs, introStart: S.introStart, eventSeed: S.eventSeed })
    if (frame.event === 'golden') caption.sub = GOLDEN_QUIP
    const { columns: cw, rows: ch, cells } = toRasterCells(frame.rows)
    const side = columns >= SIDE_BY_SIDE_COLUMNS
    return (
      <Box flexDirection={side ? 'row' : 'column'} gap={side ? 2 : 0}>
        <Raster key="tonk" columns={cw} rows={ch} cells={cells} />
        <Box flexDirection="column" justifyContent="flex-end" height={ch}>
          <Text wrap="truncate">
            <Text bold color={RED}>{caption.title}</Text>
            {'  '}
            <Text color={ORANGE}>{caption.bar}</Text>
            {caption.pct ? ` ${caption.pct}` : ''}
            {caption.tail ? <Text dimColor>{` · ${caption.tail}`}</Text> : null}
          </Text>
          <Text dimColor wrap="truncate">
            {caption.sub}
            {caption.five ? `   ${caption.five}` : ''}
          </Text>
        </Box>
      </Box>
    )
  })
}
