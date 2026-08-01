import type { Ending, GameState } from '../../game/types'
import { BALANCE } from '../../game/data/balance'
import { artSpec } from '../art/manifest'
import { PixelArt } from '../art/PixelArt'
import { PixelButton } from './PixelButton'

const ENDING_FLAVOR: Record<Ending, string> = {
  full_recovery: '町は光を取り戻した。あなたの30日間は、奇跡として語り継がれるだろう。',
  managed_sacrifice: '町は存続した。だが、その代償は決して小さくなかった。',
  self_governance: '復旧は遅れた。だが町は、何にも代えがたい結びつきを手に入れた。',
  collapse: '町は静まり返った。あなたの30日間は、途中で途絶えた。',
}

interface EndingOverlayProps {
  state: GameState
  onRestart: () => void
  onBackToTitle: () => void
}

export function EndingOverlay({ state, onRestart, onBackToTitle }: EndingOverlayProps) {
  if (state.phase !== 'ended' || !state.ending) return null
  const ending = state.ending
  const spec = artSpec('ending', ending)
  const reached = Math.min(state.day - 1, BALANCE.days)
  return (
    <div className="ending-overlay" role="dialog" aria-modal="true">
      <div className="ending-overlay__card">
        <PixelArt kind="ending" id={ending} />
        <h2 className="ending-overlay__title">{spec?.label ?? ending}</h2>
        <p className="ending-overlay__flavor">{ENDING_FLAVOR[ending]}</p>
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
        <div className="ending-overlay__actions">
          <PixelButton primary onClick={onRestart}>
            もう一度
          </PixelButton>
          <PixelButton onClick={onBackToTitle}>タイトルへ</PixelButton>
        </div>
      </div>
    </div>
  )
}
