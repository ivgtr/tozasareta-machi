import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { reducedMotion } from '../settings'

interface TypeTextProps {
  text: string
  speed?: number
  className?: string
  reserveSpace?: boolean
  skippable?: boolean
}

export function TypeText({
  text,
  speed = 28,
  className,
  reserveSpace = false,
  skippable = false,
}: TypeTextProps) {
  const reduced = reducedMotion()
  const [count, setCount] = useState(0)
  const textRef = useRef(text)
  const prevTextRef = useRef(text)

  useEffect(() => {
    textRef.current = text
    if (reduced) return
    const id = setInterval(() => {
      setCount((c) => {
        if (textRef.current !== prevTextRef.current) {
          prevTextRef.current = textRef.current
          return 1
        }
        if (c >= textRef.current.length) {
          clearInterval(id)
          return c
        }
        return c + 1
      })
    }, speed)
    return () => clearInterval(id)
  }, [text, speed, reduced])

  if (reduced) return <span className={className}>{text}</span>
  const done = count >= text.length
  const complete = () => setCount(text.length)
  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    complete()
  }
  const interactionProps = {
    role: skippable && !done ? ('button' as const) : undefined,
    tabIndex: skippable && !done ? 0 : undefined,
    onClick: skippable && !done ? complete : undefined,
    onKeyDown: skippable && !done ? handleKeyDown : undefined,
    'aria-label': skippable && !done ? '文章を全文表示' : undefined,
  }
  if (reserveSpace) {
    return (
      <span
        className={[
          'type-text--reserved',
          skippable && !done ? 'type-text--skippable' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...interactionProps}
      >
        <span className="type-text__reserve" aria-hidden="true">
          {text}
        </span>
        <span className="type-text__visible">
          {text.slice(0, count)}
          {done ? null : <span className="type-caret">▌</span>}
        </span>
      </span>
    )
  }
  return (
    <span
      className={[skippable && !done ? 'type-text--skippable' : '', className]
        .filter(Boolean)
        .join(' ')}
      {...interactionProps}
    >
      {text.slice(0, count)}
      {done ? null : <span className="type-caret">▌</span>}
    </span>
  )
}
