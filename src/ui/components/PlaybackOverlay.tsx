import { artSpec } from '../art/manifest'
import { PixelArt } from '../art/PixelArt'

export function PlaybackOverlay({ eventId }: { eventId: string | null }) {
  if (!eventId) return null
  const spec = artSpec('event', eventId)
  return (
    <div className="event-overlay" role="status" aria-live="polite">
      <div className="event-overlay__card">
        <PixelArt kind="event" id={eventId} />
        <span className="event-overlay__name">{spec?.label ?? eventId}</span>
      </div>
    </div>
  )
}
