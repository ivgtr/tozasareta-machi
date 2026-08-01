import { useMemo } from 'react'
import '../styles/backdrop.css'

interface Building {
  x: number
  w: number
  h: number
  cols: number
  rows: number
}

interface WindowCell {
  key: string
  x: number
  y: number
  w: number
  h: number
}

interface SkylineProps {
  power: number
  morale: number
  danger?: boolean
}

function lcg(seed: number): () => number {
  let s = seed
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) | 0
    return (s >>> 0) / 4294967296
  }
}

function makeSkyline(seed: number): Building[] {
  const rnd = lcg(seed)
  const buildings: Building[] = []
  let x = 4
  while (x < 312) {
    const w = 18 + Math.floor(rnd() * 20)
    const h = 16 + Math.floor(rnd() * 34)
    buildings.push({
      x,
      w,
      h,
      cols: Math.max(2, Math.floor(w / 8)),
      rows: Math.max(2, Math.floor(h / 9)),
    })
    x += w + 2 + Math.floor(rnd() * 6)
  }
  return buildings
}

function makeWindows(buildings: Building[]): WindowCell[] {
  const list: WindowCell[] = []
  buildings.forEach((b, bi) => {
    const top = GROUND - b.h
    const cw = (b.w - 6) / b.cols
    const ch = (b.h - 6) / b.rows
    for (let r = 0; r < b.rows; r++) {
      for (let c = 0; c < b.cols; c++) {
        list.push({
          key: `${bi}-${r}-${c}`,
          x: b.x + 3 + c * cw + 1,
          y: top + 3 + r * ch + 1,
          w: Math.max(1, cw - 2),
          h: Math.max(1, ch - 2),
        })
      }
    }
  })
  return list
}

const VIEW_W = 320
const VIEW_H = 62
const GROUND = 58

export function Skyline({ power, morale, danger = false }: SkylineProps) {
  const buildings = useMemo(() => makeSkyline(7), [])
  const windows = useMemo(() => makeWindows(buildings), [buildings])
  const litBudget = Math.round((power / 100) * windows.length)

  const classes = ['skyline', danger ? 'skyline--danger' : '', morale < 40 ? 'skyline--gloomy' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <svg
      className={classes}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
    >
      <rect x="0" y={GROUND} width={VIEW_W} height={VIEW_H - GROUND} fill="#131740" />
      {buildings.map((b, bi) => (
        <rect
          key={bi}
          x={b.x}
          y={GROUND - b.h}
          width={b.w}
          height={b.h}
          fill="#131740"
          stroke="#252c6e"
          strokeWidth="1"
        />
      ))}
      {windows.map((win, i) => (
        <rect
          key={win.key}
          className={i < litBudget ? 'skyline__window skyline__window--lit' : 'skyline__window'}
          x={win.x}
          y={win.y}
          width={win.w}
          height={win.h}
        />
      ))}
    </svg>
  )
}
