import type { CSSProperties } from 'react'
import { artSpec, type ArtKind } from './manifest'
import { resolveArtUrl } from './assets'
import './art.css'

type ArtSize = 'sm' | 'md' | 'lg'

interface PixelArtProps {
  kind: ArtKind
  id: string
  size?: ArtSize
}

export function PixelArt({ kind, id, size = 'md' }: PixelArtProps) {
  const spec = artSpec(kind, id)
  const url = resolveArtUrl(kind, id)
  if (url) {
    return <img className={`pixel-art pixel-art--${size}`} src={url} alt={spec?.label ?? id} />
  }
  return <PlaceholderArt kind={kind} id={id} size={size} />
}

function PlaceholderArt({ kind, id, size }: PixelArtProps) {
  const spec = artSpec(kind, id)
  if (!spec) return <div className={`ph ph--missing ph--${size}`}>?</div>
  const style = { '--ph-color': spec.color } as CSSProperties

  switch (kind) {
    case 'icon':
      return (
        <span
          className={`ph-tile ph-tile--${size}`}
          style={style}
          role="img"
          aria-label={spec.label}
        >
          {spec.glyph}
        </span>
      )
    case 'event':
      return (
        <figure className="ph-card" style={style} role="img" aria-label={spec.label}>
          <span className="ph-card__glyph">{spec.glyph}</span>
          <span className="ph-card__scan" aria-hidden="true" />
          <figcaption className="ph-card__label">{spec.label}</figcaption>
          <span className="ph-card__stamp">PHOTO / 現像中</span>
        </figure>
      )
    case 'portrait':
      return (
        <div className="ph-portrait" style={style} role="img" aria-label={spec.label}>
          <span className="ph-portrait__silhouette">人</span>
          <span className="ph-portrait__role">{spec.glyph}</span>
        </div>
      )
    case 'ending':
      return (
        <div className="ph-ending" style={style} role="img" aria-label={spec.label}>
          <span className="ph-ending__glyph">{spec.glyph}</span>
        </div>
      )
    case 'briefing':
      return <div className="ph-briefing" style={style} role="img" aria-label={spec.label} />
    default:
      return null
  }
}
