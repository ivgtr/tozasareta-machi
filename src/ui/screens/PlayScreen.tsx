import { useState } from 'react'
import type { DayPlan, GameState, TaskId } from '../../game/types'
import { BALANCE } from '../../game/data/balance'
import { useStore } from '../store-context'
import { randomSeed } from '../store'
import { AmbientBackdrop } from '../components/AmbientBackdrop'
import { Skyline } from '../components/Skyline'
import { TopBar } from '../components/TopBar'
import { StatusWall } from '../components/StatusWall'
import { DecisionBoard } from '../components/DecisionBoard'
import { ReportFeed } from '../components/ReportFeed'
import { EndingOverlay } from '../components/EndingOverlay'
import { PixelPanel } from '../components/PixelPanel'
import '../styles/play.css'

function DayBoard({ state, onCommit }: { state: GameState; onCommit: (plan: DayPlan) => void }) {
  const [selectedChar, setSelectedChar] = useState<string | null>(null)
  const [chars, setChars] = useState<Partial<Record<TaskId, string>>>({})

  const assignChar = (task: TaskId) => {
    if (!selectedChar) return
    setChars((prev) => {
      const next: Partial<Record<TaskId, string>> = {}
      for (const [k, v] of Object.entries(prev)) {
        if (v !== selectedChar) next[k as TaskId] = v
      }
      next[task] = selectedChar
      return next
    })
    setSelectedChar(null)
  }

  const releaseChar = (task: TaskId) =>
    setChars((prev) => {
      const next = { ...prev }
      delete next[task]
      return next
    })

  return (
    <main className="play__grid">
      <PixelPanel title="町の状況" className="play__status">
        <StatusWall
          state={state}
          chars={chars}
          selectedChar={selectedChar}
          onSelectChar={setSelectedChar}
        />
      </PixelPanel>
      <PixelPanel title="本日の対応" className="play__board">
        <DecisionBoard
          state={state}
          chars={chars}
          selectedChar={selectedChar}
          onCommit={onCommit}
          onAssignChar={assignChar}
          onReleaseChar={releaseChar}
        />
      </PixelPanel>
      <PixelPanel title="本部記録" className="play__log">
        <ReportFeed report={state.report} />
      </PixelPanel>
    </main>
  )
}

export function PlayScreen() {
  const { store, dispatch } = useStore()
  const state: GameState = store.state

  const commit = (plan: DayPlan) => dispatch({ type: 'commitDay', plan })
  const undo = () => dispatch({ type: 'undo' })
  const restart = () => {
    if (window.confirm('新しいゲームを始めますか？現在の進行は失われます。')) {
      dispatch({ type: 'newGame', seed: randomSeed() })
    }
  }

  const danger = state.resources.morale < BALANCE.morale.riotAt || state.resources.food <= 0

  return (
    <div className="play">
      <AmbientBackdrop morale={state.resources.morale} danger={danger} rain={false} />
      <TopBar state={state} canUndo={store.history.length > 0} onUndo={undo} onRestart={restart} />
      <DayBoard key={state.day} state={state} onCommit={commit} />
      <footer className="play__footer">
        <Skyline power={state.resources.power} morale={state.resources.morale} danger={danger} />
      </footer>
      <EndingOverlay
        state={state}
        onRestart={() => dispatch({ type: 'newGame', seed: randomSeed() })}
      />
    </div>
  )
}
