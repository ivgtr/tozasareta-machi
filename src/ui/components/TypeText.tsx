import { useEffect, useRef, useState } from 'react'
import { reducedMotion } from '../settings'

interface TypeTextProps {
  text: string
  speed?: number
  className?: string
}

export function TypeText({ text, speed = 28, className }: TypeTextProps) {
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
  return (
    <span className={className}>
      {text.slice(0, count)}
      {done ? null : <span className="type-caret">▌</span>}
    </span>
  )
}
