import { useCallback, type ReactNode } from 'react'
import type { DayPlan, Effect, GameState } from '../../game/types'
import { step, applyEffects } from '../../game/engine'
import { BALANCE } from '../../game/data/balance'
import { useStore } from '../store-context'
import { randomSeed } from '../store'
import { usePlayback } from '../hooks/usePlayback'
import { AmbientBackdrop } from '../components/AmbientBackdrop'
import { Skyline } from '../components/Skyline'
import { TopBar } from '../components/TopBar'
import { StatusWall } from '../components/StatusWall'
import { DecisionBoard } from '../components/DecisionBoard'
import { ReportFeed } from '../components/ReportFeed'
import { EndingOverlay } from '../components/EndingOverlay'
import { PlaybackOverlay } from '../components/PlaybackOverlay'
import { ArrivalOverlay } from '../components/ArrivalOverlay'
import { PixelPanel } from '../components/PixelPanel'
import { PixelButton } from '../components/PixelButton'
import '../styles/play.css'

function DayBoard({
  state,
  busy,
  report,
  animateReport,
  onCommit,
}: {
  state: GameState
  busy: boolean
  report: GameState['report']
  animateReport: boolean
  onCommit: (plan: DayPlan) => void
}) {
  return (
    <main className="play__grid">
      <PixelPanel title="町の状況" className="play__status">
        <StatusWall state={state} />
      </PixelPanel>
      <PixelPanel title="本日の対応" className="play__board">
        <DecisionBoard state={state} busy={busy} onCommit={onCommit} />
      </PixelPanel>
      <PixelPanel title="本部記録" className="play__log">
        <ReportFeed report={report} animateLast={animateReport} />
      </PixelPanel>
    </main>
  )
}

export function PlayScreen({ onExit }: { onExit: () => void }) {
  const { store, dispatch } = useStore()
  const state: GameState = store.state

  const pauseOn = useCallback(
    (e: Effect) => {
      if (!e.target.startsWith('unit:')) return false
      const id = e.target.slice('unit:'.length)
      const u = state.units.find((x) => x.id === id)
      return u?.alias !== undefined
    },
    [state],
  )
  const { pb, waiting, start, skip, confirm } = usePlayback(pauseOn)
  const busy = pb !== null

  const view: GameState =
    pb !== null
      ? { ...applyEffects(pb.prev, pb.effects.slice(0, pb.index)), day: pb.prev.day }
      : state
  const feedReport = pb !== null ? pb.effects.slice(0, pb.index) : state.report
  const currentEffect = pb !== null && pb.index > 0 ? (pb.effects[pb.index - 1] ?? null) : null

  let overlay: ReactNode = null
  if (currentEffect?.target.startsWith('unit:') === true) {
    const uid = currentEffect.target.slice('unit:'.length)
    const unit = state.units.find((u) => u.id === uid)
    if (unit) overlay = <ArrivalOverlay unit={unit} waiting={waiting} onContinue={confirm} />
  } else {
    const eventId =
      currentEffect?.source.startsWith('event:') === true
        ? currentEffect.source.slice('event:'.length)
        : null
    overlay = <PlaybackOverlay eventId={eventId} />
  }

  const commit = (plan: DayPlan) => {
    if (busy) return
    const result = step(state, { type: 'commitDay', plan })
    dispatch({ type: 'commitDay', plan })
    start(state, result.effects)
  }
  const undo = () => dispatch({ type: 'undo' })
  const restart = () => {
    if (window.confirm('新しいゲームを始めますか？現在の進行は失われます。')) {
      dispatch({ type: 'newGame', seed: randomSeed() })
    }
  }

  const danger = view.resources.morale < BALANCE.morale.riotAt || view.resources.food <= 0

  return (
    <div className={['play', busy ? 'play--busy' : ''].filter(Boolean).join(' ')}>
      <AmbientBackdrop morale={view.resources.morale} danger={danger} rain={false} />
      <TopBar
        state={view}
        canUndo={store.history.length > 0 && !busy}
        onUndo={undo}
        onRestart={restart}
      />
      <DayBoard
        key={view.day}
        state={view}
        busy={busy}
        report={feedReport}
        animateReport={busy}
        onCommit={commit}
      />
      <footer className="play__footer">
        <Skyline power={view.resources.power} morale={view.resources.morale} danger={danger} />
      </footer>
      {busy && !waiting ? (
        <PixelButton className="play__skip" onClick={skip}>
          スキップ ▶▶
        </PixelButton>
      ) : null}
      {overlay}
      {busy ? null : (
        <EndingOverlay
          state={state}
          onRestart={() => dispatch({ type: 'newGame', seed: randomSeed() })}
          onBackToTitle={onExit}
        />
      )}
    </div>
  )
}
