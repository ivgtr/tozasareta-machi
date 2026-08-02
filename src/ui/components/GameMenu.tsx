import { useEffect, useRef } from 'react'
import { PixelButton } from './PixelButton'

interface GameMenuProps {
  onClose: () => void
  onBackToTitle: () => void
  onRestart: () => void
}

export function GameMenu({ onClose, onBackToTitle, onRestart }: GameMenuProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled)')
      if (!focusable?.length) return
      const first = focusable.item(0)
      const last = focusable.item(focusable.length - 1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="game-menu-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-menu-title"
      onClick={onClose}
    >
      <div ref={dialogRef} className="game-menu" onClick={(event) => event.stopPropagation()}>
        <h2 id="game-menu-title" className="game-menu__title">
          ゲームメニュー
        </h2>
        <p className="game-menu__note">タイトルへ戻ると、本日の未確定な配置は破棄されます。</p>
        <div className="game-menu__actions">
          <PixelButton ref={closeRef} primary onClick={onClose}>
            ゲームに戻る
          </PixelButton>
          <PixelButton
            onClick={() => {
              onClose()
              onBackToTitle()
            }}
          >
            タイトルに戻る
          </PixelButton>
          <PixelButton
            className="game-menu__restart"
            onClick={() => {
              onClose()
              onRestart()
            }}
          >
            最初から
          </PixelButton>
        </div>
      </div>
    </div>
  )
}
