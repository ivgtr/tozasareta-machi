import { AmbientBackdrop } from '../components/AmbientBackdrop'
import { Skyline } from '../components/Skyline'
import { PixelPanel } from '../components/PixelPanel'
import { PixelButton } from '../components/PixelButton'
import { Gauge } from '../components/Gauge'
import { TypeText } from '../components/TypeText'
import { WorkerToken } from '../components/WorkerToken'
import { PixelArt } from '../art/PixelArt'
import { PALETTE, specsByKind } from '../art/manifest'
import { moraleLabel } from '../../game/state'
import '../styles/preview.css'

const DUMMY = {
  day: 12,
  food: 46,
  power: 42,
  medical: 27,
  morale: 55,
  workers: 5,
}

const TASK_ROWS = [
  { id: 'repair_power', note: '→ 電力 +19', tokens: 1 },
  { id: 'restore_road', note: '→ 食料 +18', tokens: 2 },
  { id: 'soup_kitchen', note: '→ 士気 +11', tokens: 1 },
] as const

export function PreviewScreen() {
  const portraits = specsByKind('portrait')
  const usedTokens = TASK_ROWS.reduce((s, t) => s + t.tokens, 0)

  return (
    <div className="preview">
      <AmbientBackdrop morale={DUMMY.morale} danger={false} rain={false} />

      <header className="preview__top">
        <div className="preview__day">
          <span className="preview__day-num">{DUMMY.day}</span>
          <span className="preview__day-total">/ 30</span>
        </div>
        <div className="preview__alert">
          <PixelArt kind="icon" id="alert_warning" size="sm" />
          <span>食料の残りが少なくなっています</span>
        </div>
        <div className="preview__top-actions">
          <PixelButton>待機</PixelButton>
          <PixelButton>再開</PixelButton>
        </div>
      </header>

      <main className="preview__grid">
        <PixelPanel title="町の状況" className="preview__status">
          <Gauge label="食料" value={DUMMY.food} color={PALETTE.amber} stateWord="残り2日分" />
          <Gauge label="電力" value={DUMMY.power} color={PALETTE.cyan} stateWord="低下中" />
          <Gauge
            label="医療"
            value={DUMMY.medical}
            color={PALETTE.green}
            stateWord="逼迫している"
          />
          <Gauge
            label="士気"
            value={DUMMY.morale}
            color={PALETTE.gold}
            stateWord={moraleLabel(DUMMY.morale)}
          />
          <h3 className="preview__sub">人員</h3>
          <div className="preview__roster">
            {portraits.map((p) => (
              <div key={p.id} className="preview__char">
                <PixelArt kind="portrait" id={p.id} />
                <span>{p.label}</span>
              </div>
            ))}
          </div>
        </PixelPanel>

        <PixelPanel title="本日の対応" className="preview__board">
          <ul className="preview__tasks">
            {TASK_ROWS.map((t) => (
              <li key={t.id} className="preview__task">
                <PixelArt kind="icon" id={t.id} size="md" />
                <div className="preview__task-body">
                  <div className="preview__task-name">
                    {specsByKind('icon').find((s) => s.id === t.id)?.label}
                  </div>
                  <div className="preview__task-note">{t.note}</div>
                </div>
                <div className="preview__task-tokens">
                  {Array.from({ length: t.tokens }, (_, i) => (
                    <WorkerToken key={i} />
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <div className="preview__pool-row">
            <span className="preview__pool-label">作業員</span>
            <div className="preview__pool">
              {Array.from({ length: DUMMY.workers }, (_, i) => (
                <WorkerToken key={i} dim={i < usedTokens} />
              ))}
            </div>
          </div>
          <PixelButton primary className="preview__commit">
            作戦を開始する
          </PixelButton>
        </PixelPanel>

        <PixelPanel title="本部記録" className="preview__log">
          <p className="preview__log-line preview__log-line--fresh">
            <TypeText text="第11日: 配給を絞ったため、住民の不満が高まった。" />
          </p>
          <p className="preview__log-line">第10日: 発電機が故障し、電力が大きく落ちた。</p>
          <p className="preview__log-line">第9日: 道路を復旧し、食料を搬入した。</p>
          <div className="preview__event-card">
            <PixelArt kind="event" id="refugees" />
          </div>
        </PixelPanel>
      </main>

      <footer className="preview__footer">
        <Skyline power={DUMMY.power} morale={DUMMY.morale} danger={false} />
      </footer>
    </div>
  )
}
