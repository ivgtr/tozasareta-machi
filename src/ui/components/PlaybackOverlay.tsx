import type { Effect } from '../../game/types'
import { artSpec } from '../art/manifest'
import { PixelArt } from '../art/PixelArt'
import { PixelButton } from './PixelButton'

interface PlaybackOverlayProps {
  eventId: string
  effects: Effect[]
  onContinue: () => void
}

export function PlaybackOverlay({ eventId, effects, onContinue }: PlaybackOverlayProps) {
  const spec = artSpec('event', eventId)
  return (
    <div className="spotlight" role="dialog" aria-modal="true">
      <div className="spotlight__card">
        <div className="spotlight__art">
          <PixelArt kind="event" id={eventId} />
        </div>
        <h3 className="spotlight__title">{spec?.label ?? eventId}</h3>
        <ul className="spotlight__reasons">
          {effects.map((e, i) => (
            <li key={i}>{e.reason}</li>
          ))}
        </ul>
        <PixelButton primary onClick={onContinue}>
          続ける
        </PixelButton>
      </div>
    </div>
  )
}
