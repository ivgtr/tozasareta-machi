import type { Aptitude, Unit } from '../../game/types'
import { TRAITS } from '../../game/traits'
import { APTITUDE_LABEL } from '../../game/data/units'
import { PixelArt } from '../art/PixelArt'
import { PixelButton } from './PixelButton'

const APTS: Aptitude[] = ['labor', 'tech', 'medical', 'charm']
const APT_COLOR: Record<Aptitude, string> = {
  labor: 'var(--amber)',
  tech: 'var(--cyan)',
  medical: 'var(--green)',
  charm: 'var(--gold)',
}

interface ArrivalOverlayProps {
  unit: Unit
  waiting: boolean
  onContinue: () => void
}

export function ArrivalOverlay({ unit, waiting, onContinue }: ArrivalOverlayProps) {
  const unique = unit.alias !== undefined

  if (!unique) {
    return (
      <div className="arrival-card" role="status">
        <PixelArt kind="portrait" id={unit.portrait} glyph="人" />
        <div className="arrival-card__body">
          <div className="arrival-card__name">{unit.name}</div>
          <div className="arrival-card__apt">
            {APTS.map((a) => (
              <span key={a} style={{ color: APT_COLOR[a] }}>
                {APTITUDE_LABEL[a].slice(0, 1)}
                {unit.apt[a]}
              </span>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="arrival-overlay" role="dialog" aria-modal="true">
      <div className="arrival-overlay__card">
        <p className="arrival-overlay__kicker">新たな仲間が辿り着いた</p>
        <div className="arrival-overlay__portrait">
          <PixelArt kind="portrait" id={unit.portrait} glyph="人" />
        </div>
        <h2 className="arrival-overlay__name">{unit.name}</h2>
        <p className="arrival-overlay__alias">二つ名: {unit.alias}</p>
        <dl className="arrival-overlay__apt">
          {APTS.map((a) => (
            <div key={a} className="arrival-overlay__apt-row">
              <dt style={{ color: APT_COLOR[a] }}>{APTITUDE_LABEL[a]}</dt>
              <dd>
                <div className="arrival-overlay__bar">
                  <div
                    className="arrival-overlay__bar-fill"
                    style={{ width: `${unit.apt[a] * 10}%`, background: APT_COLOR[a] }}
                  />
                </div>
                <span className="arrival-overlay__apt-num">{unit.apt[a]}</span>
              </dd>
            </div>
          ))}
        </dl>
        {unit.traits.length > 0 ? (
          <div className="arrival-overlay__traits">
            {unit.traits.map((t) => (
              <span
                key={t}
                className={
                  TRAITS[t].positive
                    ? 'arrival-overlay__trait'
                    : 'arrival-overlay__trait arrival-overlay__trait--neg'
                }
              >
                {TRAITS[t].name}: {TRAITS[t].desc}
              </span>
            ))}
          </div>
        ) : null}
        {unit.flavor ? <p className="arrival-overlay__flavor">{unit.flavor}</p> : null}
        {waiting ? (
          <PixelButton primary onClick={onContinue}>
            迎え入れる
          </PixelButton>
        ) : null}
      </div>
    </div>
  )
}
