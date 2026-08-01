import type { GameState } from '../../game/types'
import { findEvent } from '../../game/events'
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
  if (!event || !event.choices) return null
  const options = event.choices.filter((o) => pending.optionIds.includes(o.id))

  return (
    <div className="choice-overlay" role="dialog" aria-modal="true">
      <div className="choice-overlay__card">
        <p className="choice-overlay__kicker">判断を求められている</p>
        <div className="choice-overlay__art">
          <PixelArt kind="event" id={event.id} />
        </div>
        <h3 className="choice-overlay__name">{event.name}</h3>
        <div className="choice-overlay__options">
          {options.map((o) => (
            <PixelButton
              key={o.id}
              className="choice-overlay__option"
              onClick={() => onChoose(o.id)}
            >
              <span className="choice-overlay__label">{o.label}</span>
              {o.desc ? <span className="choice-overlay__desc">{o.desc}</span> : null}
            </PixelButton>
          ))}
        </div>
      </div>
    </div>
  )
}
