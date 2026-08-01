import type { ReactNode } from 'react'
import '../styles/components.css'

interface PixelPanelProps {
  title?: string
  className?: string
  children: ReactNode
}

export function PixelPanel({ title, className, children }: PixelPanelProps) {
  return (
    <section className={['pixel-panel', className ?? ''].filter(Boolean).join(' ')}>
      {title ? <h2 className="pixel-panel__title">{title}</h2> : null}
      <div className="pixel-panel__body">{children}</div>
    </section>
  )
}
