import type { DeviceClass } from '../layout'
import type { Rect } from '../regions'
import { FACILITY_PLOTS, TOWN_BASE, type FacilityId } from './layout'

export type TownViewportPreset =
  | { mode: 'overview' }
  | { mode: 'unit-focus'; facility: FacilityId | null }
  | { mode: 'facility-focus'; facility: FacilityId }
  | { mode: 'playback-target'; facility: FacilityId }

export interface TownViewportTransform {
  x: number
  y: number
  scale: number
}

function centeredOffset(start: number, size: number, contentSize: number): number {
  return start + (size - contentSize) / 2
}

function focusedOffset(start: number, size: number, contentSize: number, target: number): number {
  const edge = start + size - contentSize
  return Math.max(Math.min(start, edge), Math.min(Math.max(start, edge), target))
}

export function deriveTownViewport(
  region: Rect,
  deviceClass: DeviceClass,
  preset: TownViewportPreset,
): TownViewportTransform {
  const fit = Math.min(region.width / TOWN_BASE.width, region.height / TOWN_BASE.height)
  const overviewScale = fit * (deviceClass === 'wide' ? 1.08 : 1.28)
  const scale = preset.mode === 'overview' ? overviewScale : overviewScale * 1.18
  const contentWidth = TOWN_BASE.width * scale
  const contentHeight = TOWN_BASE.height * scale

  if (preset.mode === 'overview') {
    return {
      x: centeredOffset(region.x, region.width, contentWidth),
      y: centeredOffset(region.y, region.height, contentHeight),
      scale,
    }
  }

  const facility = preset.facility ?? 'hq'
  const plot = FACILITY_PLOTS.find((candidate) => candidate.id === facility)
  if (!plot) throw new Error(`Unknown facility: ${facility}`)
  const focusX = region.x + region.width * (deviceClass === 'wide' ? 0.34 : 0.5)
  const focusY = region.y + region.height * (deviceClass === 'wide' ? 0.5 : 0.68)
  return {
    x: focusedOffset(region.x, region.width, contentWidth, focusX - plot.x * scale),
    y: focusedOffset(region.y, region.height, contentHeight, focusY - plot.y * scale),
    scale,
  }
}
