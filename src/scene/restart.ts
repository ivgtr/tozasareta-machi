interface RestartPlayback {
  skip(): void
}

interface NewGameDispatcher {
  dispatch(action: { type: 'newGame'; seed: number }): void
}

export function restartGame(
  playback: RestartPlayback,
  store: NewGameDispatcher,
  seed: number,
): void {
  playback.skip()
  store.dispatch({ type: 'newGame', seed })
}
