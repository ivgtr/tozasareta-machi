import type { GameState } from '../../game/types'
import { choiceOptions, findEvent } from '../../game/events'
import { PixelArt } from '../art/PixelArt'
import { PixelButton } from './PixelButton'

interface ChoiceOverlayProps {
  state: GameState
  onChoose: (optionId: string) => void
}

export function ChoiceOverlay({ state, onChoose }: ChoiceOverlayProps) {
  const pending = state.pendingChoice
  if (!pending) return null
  const event = findEvent(pending.eventId)
  if (!event) return null
  const options = choiceOptions(state, event).filter((o) => pending.optionIds.includes(o.id))
  const unitOptions = options.filter((o) => o.id.startsWith('send_'))
  const otherOptions = options.filter((o) => !o.id.startsWith('send_'))

  return (
    <div className="choice-overlay" role="dialog" aria-modal="true">
      <div className="choice-overlay__card">
        <p className="choice-overlay__kicker">判断を求められている</p>
        <div className="choice-overlay__art">
          <PixelArt kind="event" id={event.id} />
        </div>
        <h3 className="choice-overlay__name">{event.name}</h3>
        {unitOptions.length > 0 ? (
          <div className="choice-overlay__unit-grid">
            {unitOptions.map((o) => (
              <PixelButton
                key={o.id}
                className="choice-overlay__unit"
                onClick={() => onChoose(o.id)}
              >
                <span className="choice-overlay__label">{o.label}</span>
                {o.desc ? <span className="choice-overlay__desc">{o.desc}</span> : null}
              </PixelButton>
            ))}
          </div>
        ) : null}
        {otherOptions.map((o) => (
          <PixelButton key={o.id} className="choice-overlay__option" onClick={() => onChoose(o.id)}>
            <span className="choice-overlay__label">{o.label}</span>
            {o.desc ? <span className="choice-overlay__desc">{o.desc}</span> : null}
          </PixelButton>
        ))}
      </div>
    </div>
  )
}
