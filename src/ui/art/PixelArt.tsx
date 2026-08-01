import type { CSSProperties } from 'react'
import { artSpec, type ArtKind } from './manifest'
import { resolveArtUrl } from './assets'
import './art.css'

type ArtSize = 'sm' | 'md' | 'lg'

interface PixelArtProps {
  kind: ArtKind
  id: string
  size?: ArtSize
  glyph?: string
}

export function PixelArt({ kind, id, size = 'md', glyph }: PixelArtProps) {
  const spec = artSpec(kind, id)
  const url = resolveArtUrl(kind, id)
  if (url) {
    return <img className={`pixel-art pixel-art--${size}`} src={url} alt={spec?.label ?? id} />
  }
  return <PlaceholderArt kind={kind} id={id} size={size} glyph={glyph} />
}

function PlaceholderArt({ kind, id, size, glyph }: PixelArtProps) {
  const spec = artSpec(kind, id)
  const g = spec?.glyph ?? glyph
  const style = (spec ? { '--ph-color': spec.color } : {}) as CSSProperties

  if (kind === 'portrait') {
    return (
      <div className="ph-portrait" style={style} role="img" aria-label={spec?.label ?? id}>
        <span className="ph-portrait__silhouette">{g ?? '人'}</span>
      </div>
    )
  }

  if (!spec) {
    if (g) {
      return (
        <span className={`ph-tile ph-tile--${size}`} role="img" aria-label={id}>
          {g}
        </span>
      )
    }
    return <div className={`ph ph--missing ph--${size}`}>?</div>
  }

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
