import { BALANCE } from '../../game/data/balance'
import { useSettings, updateSettings } from '../settings'
import { AmbientBackdrop } from '../components/AmbientBackdrop'
import { PixelButton } from '../components/PixelButton'
import { TypeText } from '../components/TypeText'
import '../styles/title.css'

const BRIEFING = `─ 緊急派遣要請 ─

昨夜の豪雨により、唯一の幹線道路が寸断された。
橋は崩落し、町は外部から孤立している。

電力は衰え、物資は細りつつある。
救援隊の到着は、推定 ${BALANCE.days} 日後。

貴殿を【臨時対策責任者】に任命する。

限られた作業員と物資を配分し、
道が開かれるその日まで、この町を生かし続けよ。`

interface TitleScreenProps {
  onNewGame: () => void
  onResume: () => void
  canResume: boolean
}

export function TitleScreen({ onNewGame, onResume, canResume }: TitleScreenProps) {
  const settings = useSettings()
  return (
    <div className="title">
      <AmbientBackdrop morale={60} />
      <header className="title__header">
        <p className="title__system">町災害対策本部 ／ 緊急対応システム</p>
        <h1 className="title__name">
          孤立した町
          <span className="title__name-sub">の30日間</span>
        </h1>
      </header>

      <div className="title__dispatch">
        <p className="title__classification">極秘 ／ 優先度・甲</p>
        <pre className="title__briefing">
          <TypeText text={BRIEFING} speed={16} />
        </pre>
        <div className="title__actions">
          <PixelButton primary onClick={onNewGame}>
            ▶ 指揮所へ
          </PixelButton>
          {canResume ? <PixelButton onClick={onResume}>続きから</PixelButton> : null}
          <button
            type="button"
            className="title__motion"
            onClick={() => updateSettings({ animations: !settings.animations })}
          >
            演出: {settings.animations ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      <p className="title__hint">
        ターン制運営シミュレーション ／ {BALANCE.days}日間の判断が町の運命を決める
      </p>
    </div>
  )
}
