import type { GameState } from '../../game/types'
import { BALANCE } from '../../game/data/balance'
import { artSpec } from '../art/manifest'
import { PixelArt } from '../art/PixelArt'
import { PixelButton } from './PixelButton'

interface EndingOverlayProps {
  state: GameState
  onRestart: () => void
}

export function EndingOverlay({ state, onRestart }: EndingOverlayProps) {
  if (state.phase !== 'ended' || !state.ending) return null
  const spec = artSpec('ending', state.ending)
  const reached = Math.min(state.day - 1, BALANCE.days)
  return (
    <div className="ending-overlay" role="dialog" aria-modal="true">
      <div className="ending-overlay__card">
        <PixelArt kind="ending" id={state.ending} />
        <h2 className="ending-overlay__title">{spec?.label ?? state.ending}</h2>
        <dl className="ending-overlay__stats">
          <div>
            <dt>到達</dt>
            <dd>第{reached}日</dd>
          </div>
          <div>
            <dt>犠牲者</dt>
            <dd>{state.flags.casualties}</dd>
          </div>
          <div>
            <dt>協力</dt>
            <dd>{state.flags.cooperation}</dd>
          </div>
        </dl>
        <PixelButton primary onClick={onRestart}>
          もう一度
        </PixelButton>
      </div>
    </div>
  )
}
