import type { ReactNode } from 'react'
import type { DayPlan, GameState } from '../../game/types'
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
import { ChoiceOverlay } from '../components/ChoiceOverlay'
import { PixelPanel } from '../components/PixelPanel'
import { PixelButton } from '../components/PixelButton'
import '../styles/play.css'

function DayBoard({
  state,
  busy,
  report,
  animateReport,
  danger,
  onCommit,
}: {
  state: GameState
  busy: boolean
  report: GameState['report']
  animateReport: boolean
  danger: boolean
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
      <div className="play__right">
        <PixelPanel title="本部記録" className="play__log">
          <ReportFeed report={report} animateLast={animateReport} />
        </PixelPanel>
        <PixelPanel title="町の様子" className="play__town-view">
          <Skyline power={state.resources.power} morale={state.resources.morale} danger={danger} />
        </PixelPanel>
      </div>
    </main>
  )
}

export function PlayScreen({ onExit }: { onExit: () => void }) {
  const { store, dispatch } = useStore()
  const state: GameState = store.state

  const { pb, waiting, start, skip, confirm } = usePlayback()
  const busy = pb !== null

  const reportEffects = pb
    ? pb.beats.slice(0, pb.index + 1).flatMap((b) => b.effects)
    : state.report
  const view: GameState = pb ? { ...applyEffects(pb.prev, reportEffects), day: pb.prev.day } : state
  const beat = pb ? (pb.beats[pb.index] ?? undefined) : undefined

  let overlay: ReactNode = null
  if (beat?.kind === 'event') {
    overlay = <PlaybackOverlay eventId={beat.id} effects={beat.effects} onContinue={confirm} />
  } else if (beat?.kind === 'arrival') {
    const unit = state.units.find((u) => u.id === beat.unitId)
    if (unit) overlay = <ArrivalOverlay unit={unit} onContinue={confirm} />
  }

  const commit = (plan: DayPlan) => {
    if (busy) return
    const result = step(state, { type: 'commitDay', plan })
    dispatch({ type: 'commitDay', plan })
    start(state, result.effects)
  }
  const resolveChoice = (optionId: string) => {
    if (busy) return
    const result = step(state, { type: 'resolveChoice', optionId })
    dispatch({ type: 'resolveChoice', optionId })
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
        onBackToTitle={onExit}
      />
      <DayBoard
        key={`${view.rng.seed}:${view.day}`}
        state={view}
        busy={busy}
        report={reportEffects}
        animateReport={busy}
        danger={danger}
        onCommit={commit}
      />
      {busy && !waiting ? (
        <PixelButton className="play__skip" onClick={skip}>
          スキップ ▶▶
        </PixelButton>
      ) : null}
      {overlay}
      {!busy && state.phase === 'choice' ? (
        <ChoiceOverlay state={state} onChoose={resolveChoice} />
      ) : null}
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
