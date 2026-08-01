import { useState } from 'react'
import { StoreProvider } from './StoreProvider'
import { useStore } from './store-context'
import { randomSeed } from './store'
import { PlayScreen } from './screens/PlayScreen'
import { TitleScreen } from './screens/TitleScreen'

type Screen = 'title' | 'play'

function Root() {
  const [screen, setScreen] = useState<Screen>('title')
  const { store, dispatch } = useStore()

  const hasProgress = store.state.report.length > 0 || store.state.day > 1
  const canResume = hasProgress && store.state.phase === 'planning'

  const newGame = () => {
    if (hasProgress && !window.confirm('新しいゲームを始めますか？現在の進行は失われます。')) return
    dispatch({ type: 'newGame', seed: randomSeed() })
    setScreen('play')
  }
  const resume = () => setScreen('play')
  const backToTitle = () => setScreen('title')

  if (screen === 'title') {
    return <TitleScreen onNewGame={newGame} onResume={resume} canResume={canResume} />
  }
  return <PlayScreen onExit={backToTitle} />
}

export function App() {
  return (
    <StoreProvider>
      <Root />
    </StoreProvider>
  )
}
