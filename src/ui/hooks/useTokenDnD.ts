import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'

export type DragSlot = string

export interface DragInfo {
  from: DragSlot
  x: number
  y: number
  over: DragSlot | null
}

interface UseTokenDnDOptions {
  onMove: (from: DragSlot, to: DragSlot) => void
}

export function useTokenDnD({ onMove }: UseTokenDnDOptions) {
  const [drag, setDrag] = useState<DragInfo | null>(null)
  const dragRef = useRef<DragInfo | null>(null)
  const onMoveRef = useRef(onMove)

  useEffect(() => {
    onMoveRef.current = onMove
  })

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      const current = dragRef.current
      if (!current) return
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const over = el?.closest('[data-slot]')?.getAttribute('data-slot') ?? null
      const next: DragInfo = { ...current, x: e.clientX, y: e.clientY, over }
      dragRef.current = next
      setDrag(next)
    }
    const handleUp = () => {
      const info = dragRef.current
      if (!info) return
      dragRef.current = null
      setDrag(null)
      if (info.over && info.over !== info.from) onMoveRef.current(info.from, info.over)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [])

  const startDrag = useCallback(
    (from: DragSlot) => (e: ReactPointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const info: DragInfo = { from, x: e.clientX, y: e.clientY, over: null }
      dragRef.current = info
      setDrag(info)
    },
    [],
  )

  return { drag, startDrag }
}
