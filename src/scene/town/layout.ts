export const TILE = { width: 48, height: 24 } as const

export const TOWN_BASE = { width: 480, height: 320 } as const

export const FOOTPRINT = { width: 96, height: 48 } as const

export type FacilityId = 'hq' | 'power' | 'road' | 'clinic' | 'plaza' | 'warehouse'

export interface FacilityPlot {
  id: FacilityId
  gx: number
  gy: number
  x: number
  y: number
}

const ORIGIN_X = TOWN_BASE.width / 2
const ORIGIN_Y = 96

export function project(gx: number, gy: number): { x: number; y: number } {
  return {
    x: ORIGIN_X + (gx - gy) * (TILE.width / 2),
    y: ORIGIN_Y + (gx + gy) * (TILE.height / 2),
  }
}

function plot(id: FacilityId, gx: number, gy: number): FacilityPlot {
  return { id, gx, gy, ...project(gx, gy) }
}

export const FACILITY_PLOTS: FacilityPlot[] = [
  plot('power', 1, 3),
  plot('clinic', 3, 1),
  plot('warehouse', 1, 5),
  plot('hq', 3, 3),
  plot('plaza', 3, 5),
  plot('road', 6, 4),
]

export function footprintDiamond(x: number, y: number): number[] {
  const hw = FOOTPRINT.width / 2
  const hh = FOOTPRINT.height / 2
  return [x, y - hh, x + hw, y, x, y + hh, x - hw, y]
}

export function isInsideFootprint(px: number, py: number, x: number, y: number): boolean {
  const hw = FOOTPRINT.width / 2
  const hh = FOOTPRINT.height / 2
  return Math.abs(px - x) / hw + Math.abs(py - y) / hh <= 1
}

export function facilityAt(px: number, py: number): FacilityId | null {
  for (const p of FACILITY_PLOTS) {
    if (isInsideFootprint(px, py, p.x, p.y)) return p.id
  }
  return null
}
