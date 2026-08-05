import { createGame } from './game'

const parent = document.getElementById('root')

if (parent) {
  const game = createGame(parent)
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      game.destroy(true)
    })
  }
}
