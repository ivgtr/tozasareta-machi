import { BALANCE } from '../../game/data/balance'
import { resolveArtUrl } from '../art/assets'
import '../styles/backdrop.css'

interface House {
  x: number
  w: number
  wallTop: number
  wallH: number
  roofH: number
}

interface Tree {
  x: number
  h: number
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

const VIEW_W = 320
const VIEW_H = 62
const GROUND = 58
const MAST_X = 244

function makeVillage(seed: number): { houses: House[]; trees: Tree[]; windows: WindowCell[] } {
  const rnd = lcg(seed)
  const houses: House[] = []
  const trees: Tree[] = []
  const windows: WindowCell[] = []
  let x = 6
  let wi = 0
  while (x < 312) {
    if (rnd() < 0.28) {
      trees.push({ x: x + 2, h: 8 + Math.floor(rnd() * 9) })
      x += 8 + Math.floor(rnd() * 5)
      continue
    }
    const w = 22 + Math.floor(rnd() * 14)
    const wallH = 10 + Math.floor(rnd() * 12)
    const roofH = 7 + Math.floor(rnd() * 7)
    const wallTop = GROUND - wallH
    houses.push({ x, w, wallTop, wallH, roofH })
    const cols = Math.max(1, Math.floor(w / 12))
    const rows = wallH > 15 ? 2 : 1
    const cw = (w - 6) / cols
    const rh = wallH / rows
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        windows.push({
          key: `${wi++}`,
          x: x + 3 + c * cw + cw * 0.25,
          y: wallTop + 2 + r * rh + rh * 0.2,
          w: Math.max(1, cw * 0.5),
          h: Math.max(1, rh * 0.4),
        })
      }
    }
    x += w + 3 + Math.floor(rnd() * 8)
  }
  return { houses, trees, windows }
}

const RIDGE = '0,44 40,34 92,42 150,30 210,40 268,32 320,42 320,58 0,58'

export function Skyline({ power, morale, danger = false }: SkylineProps) {
  const gloomy = morale < BALANCE.skyline.gloomyMoraleBelow

  const variantId = danger
    ? 'town_danger'
    : power < BALANCE.skyline.darkPowerBelow
      ? 'town_dark'
      : 'town_normal'
  const url = resolveArtUrl('skyline', variantId) ?? resolveArtUrl('skyline', 'town')
  if (url) {
    const imgClasses = ['skyline', 'skyline--image', gloomy ? 'skyline--gloomy' : '']
      .filter(Boolean)
      .join(' ')
    return <img className={imgClasses} src={url} alt="" />
  }

  const { houses, trees, windows } = makeVillage(7)
  const litBudget = Math.round((power / 100) * windows.length)

  const classes = ['skyline', danger ? 'skyline--danger' : '', gloomy ? 'skyline--gloomy' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <svg
      className={classes}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
    >
      <polygon points={RIDGE} fill="#0e1233" />
      <rect x="0" y={GROUND} width={VIEW_W} height={VIEW_H - GROUND} fill="#131740" />
      {trees.map((t, i) => (
        <polygon
          key={`t${i}`}
          points={`${t.x},${GROUND} ${t.x + 4},${GROUND - t.h} ${t.x + 8},${GROUND}`}
          fill="#0d1130"
        />
      ))}
      <line
        x1={MAST_X}
        y1={GROUND}
        x2={MAST_X}
        y2={GROUND - 30}
        stroke="#252c6e"
        strokeWidth="1.5"
      />
      <circle cx={MAST_X} cy={GROUND - 31} r="1.6" className="skyline__beacon" />
      {houses.map((h, i) => (
        <g key={`h${i}`}>
          <rect
            x={h.x}
            y={h.wallTop}
            width={h.w}
            height={h.wallH}
            fill="#131740"
            stroke="#252c6e"
            strokeWidth="1"
          />
          <polygon
            points={`${h.x - 2},${h.wallTop} ${h.x + h.w + 2},${h.wallTop} ${h.x + h.w / 2},${h.wallTop - h.roofH}`}
            fill="#1a2050"
          />
        </g>
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
