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

export interface TownViewportPoint {
  x: number
  y: number
}

export interface TownManualViewportState {
  centerX: number
  centerY: number
  zoom: number
}

export const TOWN_MANUAL_ZOOM = {
  min: 1,
  max: 2,
} as const

export function defaultTownManualViewport(): TownManualViewportState {
  return {
    centerX: TOWN_BASE.width / 2,
    centerY: TOWN_BASE.height / 2,
    zoom: TOWN_MANUAL_ZOOM.min,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function centeredOffset(start: number, size: number, contentSize: number): number {
  return start + (size - contentSize) / 2
}

function focusedOffset(start: number, size: number, contentSize: number, target: number): number {
  const edge = start + size - contentSize
  return Math.max(Math.min(start, edge), Math.min(Math.max(start, edge), target))
}

function manualOffset(start: number, size: number, contentSize: number, target: number): number {
  if (contentSize <= size) return centeredOffset(start, size, contentSize)
  return clamp(target, start + size - contentSize, start)
}

function centeredTransform(region: Rect, scale: number): TownViewportTransform {
  return {
    x: centeredOffset(region.x, region.width, TOWN_BASE.width * scale),
    y: centeredOffset(region.y, region.height, TOWN_BASE.height * scale),
    scale,
  }
}

export function clampTownManualViewport(
  region: Rect,
  transform: TownViewportTransform,
): TownViewportTransform {
  return {
    x: manualOffset(region.x, region.width, TOWN_BASE.width * transform.scale, transform.x),
    y: manualOffset(region.y, region.height, TOWN_BASE.height * transform.scale, transform.y),
    scale: transform.scale,
  }
}

export function deriveTownViewport(
  region: Rect,
  deviceClass: DeviceClass,
  preset: TownViewportPreset,
): TownViewportTransform {
  const fit = Math.min(region.width / TOWN_BASE.width, region.height / TOWN_BASE.height)
  const overviewScale = fit * (deviceClass === 'wide' ? 1.08 : 1.28)
  const overview = preset.mode === 'overview' || preset.mode === 'unit-focus'
  const scale = overview ? overviewScale : overviewScale * 1.18
  const contentWidth = TOWN_BASE.width * scale
  const contentHeight = TOWN_BASE.height * scale

  if (overview) {
    return {
      x: centeredOffset(region.x, region.width, contentWidth),
      y: centeredOffset(region.y, region.height, contentHeight),
      scale,
    }
  }

  const plot = FACILITY_PLOTS.find((candidate) => candidate.id === preset.facility)
  if (!plot) throw new Error(`Unknown facility: ${preset.facility}`)
  const focusX = region.x + region.width * (deviceClass === 'wide' ? 0.34 : 0.5)
  const focusY = region.y + region.height * (deviceClass === 'wide' ? 0.5 : 0.68)
  return {
    x: focusedOffset(region.x, region.width, contentWidth, focusX - plot.x * scale),
    y: focusedOffset(region.y, region.height, contentHeight, focusY - plot.y * scale),
    scale,
  }
}

export function deriveTownManualViewport(
  region: Rect,
  deviceClass: DeviceClass,
  state: TownManualViewportState,
): TownViewportTransform {
  const overview = deriveTownViewport(region, deviceClass, { mode: 'overview' })
  const zoom = clamp(state.zoom, TOWN_MANUAL_ZOOM.min, TOWN_MANUAL_ZOOM.max)
  if (zoom === TOWN_MANUAL_ZOOM.min) return overview

  const scale = overview.scale * zoom
  const centerX = region.x + region.width / 2
  const centerY = region.y + region.height / 2
  return clampTownManualViewport(region, {
    x: centerX - state.centerX * scale,
    y: centerY - state.centerY * scale,
    scale,
  })
}

export function townManualViewportFromTransform(
  region: Rect,
  deviceClass: DeviceClass,
  transform: TownViewportTransform,
): TownManualViewportState {
  const overview = deriveTownViewport(region, deviceClass, { mode: 'overview' })
  const zoom = clamp(
    transform.scale / overview.scale,
    TOWN_MANUAL_ZOOM.min,
    TOWN_MANUAL_ZOOM.max,
  )
  if (zoom === TOWN_MANUAL_ZOOM.min) return defaultTownManualViewport()

  return {
    centerX: (region.x + region.width / 2 - transform.x) / transform.scale,
    centerY: (region.y + region.height / 2 - transform.y) / transform.scale,
    zoom,
  }
}

export function transformTownViewportGesture(
  region: Rect,
  start: TownViewportTransform,
  startAnchor: TownViewportPoint,
  currentAnchor: TownViewportPoint,
  scaleFactor: number,
  minScale: number,
  maxScale: number,
): TownViewportTransform {
  const scale = clamp(start.scale * scaleFactor, minScale, maxScale)
  if (scale === minScale) return centeredTransform(region, minScale)

  const localX = (startAnchor.x - start.x) / start.scale
  const localY = (startAnchor.y - start.y) / start.scale
  return clampTownManualViewport(region, {
    x: currentAnchor.x - localX * scale,
    y: currentAnchor.y - localY * scale,
    scale,
  })
}

export function panTownViewport(
  region: Rect,
  transform: TownViewportTransform,
  dx: number,
  dy: number,
): TownViewportTransform {
  return clampTownManualViewport(region, {
    x: transform.x + dx,
    y: transform.y + dy,
    scale: transform.scale,
  })
}
