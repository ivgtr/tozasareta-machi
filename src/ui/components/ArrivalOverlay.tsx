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
  kicker?: string
  actionLabel?: string
  onContinue: () => void
}

export function ArrivalOverlay({
  unit,
  kicker = '新たな仲間が辿り着いた',
  actionLabel,
  onContinue,
}: ArrivalOverlayProps) {
  const unique = unit.unique === true

  return (
    <div className="spotlight" role="dialog" aria-modal="true">
      <div className={unique ? 'spotlight__card spotlight__card--gold' : 'spotlight__card'}>
        <p className="spotlight__kicker">{kicker}</p>
        <div
          className={unique ? 'spotlight__portrait' : 'spotlight__portrait spotlight__portrait--sm'}
        >
          <PixelArt kind="portrait" id={unit.portrait} glyph="人" />
        </div>
        <h3 className="spotlight__name">{unit.name}</h3>

        {unique ? (
          <>
            <p className="spotlight__alias">二つ名: {unit.alias}</p>
            <dl className="spotlight__apt">
              {APTS.map((a) => (
                <div key={a} className="spotlight__apt-row">
                  <dt style={{ color: APT_COLOR[a] }}>{APTITUDE_LABEL[a]}</dt>
                  <dd>
                    <div className="spotlight__bar">
                      <div
                        className="spotlight__bar-fill"
                        style={{ width: `${unit.apt[a] * 10}%`, background: APT_COLOR[a] }}
                      />
                    </div>
                    <span className="spotlight__apt-num">{unit.apt[a]}</span>
                  </dd>
                </div>
              ))}
            </dl>
            {unit.traits.length > 0 ? (
              <div className="spotlight__traits">
                {unit.traits.map((t) => (
                  <span
                    key={t}
                    className={
                      TRAITS[t].positive
                        ? 'spotlight__trait'
                        : 'spotlight__trait spotlight__trait--neg'
                    }
                  >
                    {TRAITS[t].name}: {TRAITS[t].desc}
                  </span>
                ))}
              </div>
            ) : null}
            {unit.flavor ? <p className="spotlight__flavor">{unit.flavor}</p> : null}
          </>
        ) : (
          <div className="spotlight__apt-inline">
            {APTS.map((a) => (
              <span key={a} style={{ color: APT_COLOR[a] }}>
                {APTITUDE_LABEL[a].slice(0, 1)}
                {unit.apt[a]}
              </span>
            ))}
          </div>
        )}

        <PixelButton primary onClick={onContinue}>
          {actionLabel ?? (unique ? '迎え入れる' : '続ける')}
        </PixelButton>
      </div>
    </div>
  )
}
