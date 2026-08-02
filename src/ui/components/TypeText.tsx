import { useEffect, useRef, useState } from 'react'
import { reducedMotion } from '../settings'

interface TypeTextProps {
  text: string
  speed?: number
  className?: string
  reserveSpace?: boolean
}

export function TypeText({ text, speed = 28, className, reserveSpace = false }: TypeTextProps) {
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
  if (reserveSpace) {
    return (
      <span className={['type-text--reserved', className].filter(Boolean).join(' ')}>
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
    <span className={className}>
      {text.slice(0, count)}
      {done ? null : <span className="type-caret">▌</span>}
    </span>
  )
}
