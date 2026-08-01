import type { Aptitude, Unit } from '../../game/types'
import { TRAITS } from '../../game/traits'
import { APTITUDE_LABEL } from '../../game/data/units'
import { BALANCE } from '../../game/data/balance'
import { PixelArt } from '../art/PixelArt'
import { PixelButton } from './PixelButton'

const APTS: Aptitude[] = ['labor', 'tech', 'medical', 'charm']
const APT_COLOR: Record<Aptitude, string> = {
  labor: 'var(--amber)',
  tech: 'var(--cyan)',
  medical: 'var(--green)',
  charm: 'var(--gold)',
}

interface UnitDetailsProps {
  unit: Unit | null
  onClose: () => void
}

export function UnitDetails({ unit, onClose }: UnitDetailsProps) {
  if (!unit) return null
  return (
    <div className="unit-details-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="unit-details" onClick={(e) => e.stopPropagation()}>
        <div className="unit-details__head">
          <PixelArt kind="portrait" id={unit.portrait} glyph={unit.name.slice(0, 1)} />
          <div>
            <h3 className="unit-details__name">{unit.name}</h3>
            <span
              className={
                unit.condition === 'injured'
                  ? 'unit-details__cond unit-details__cond--bad'
                  : 'unit-details__cond'
              }
            >
              {unit.condition === 'injured' ? '負傷中（効果半減）' : '健康'}
            </span>
          </div>
        </div>

        <dl className="unit-details__apt">
          {APTS.map((a) => (
            <div key={a} className="unit-details__apt-row">
              <dt style={{ color: APT_COLOR[a] }}>{APTITUDE_LABEL[a]}</dt>
              <dd>
                <div className="unit-details__bar">
                  <div
                    className="unit-details__bar-fill"
                    style={{ width: `${unit.apt[a] * 10}%`, background: APT_COLOR[a] }}
                  />
                </div>
                <span className="unit-details__apt-num">{unit.apt[a]}</span>
              </dd>
            </div>
          ))}
        </dl>

        <div className="unit-details__traits">
          {unit.traits.length === 0 ? (
            <p className="unit-details__trait-none">特性なし</p>
          ) : (
            unit.traits.map((t) => (
              <p key={t} className="unit-details__trait">
                <strong>{TRAITS[t].name}</strong>
                <span> — {TRAITS[t].desc}</span>
              </p>
            ))
          )}
        </div>

        <p className="unit-details__xp">
          成長 {unit.xp}/{BALANCE.unit.growthThreshold}（任務で適性が伸びる）
        </p>

        <PixelButton onClick={onClose}>閉じる</PixelButton>
      </div>
    </div>
  )
}
