import { createGame } from './game'

const parent = document.getElementById('root')

if (parent) {
  const game = createGame(parent)
  const e2eEnabled =
    import.meta.env.DEV && new URLSearchParams(window.location.search).get('e2e') === '1'
  if (e2eEnabled) {
    void import('./e2e-bridge').then(async ({ installE2EBridge }) => {
      installE2EBridge(game)
      const { installActTransitionE2E } = await import('./testing/e2e-act-transition')
      installActTransitionE2E(game)
    })
  }
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      game.destroy(true)
    })
  }
}
