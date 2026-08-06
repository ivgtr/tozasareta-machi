import { SCREEN_EDGE_GUARD, type DeviceClass, type SafeInsets } from './layout'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Regions {
  hud: Rect
  town: Rect
  strip: Rect
  tray: Rect
  detail: Rect
}

export const HUD_HEIGHT = { wide: 48, narrow: 44 } as const
export const TOWN_HEIGHT = { wide: 460, narrow: 380 } as const
export const STRIP_HEIGHT = 48
export const STRIP_WIDTH_WIDE = 800
export const TRAY_WIDTH_WIDE = 480
export const DETAIL_HEIGHT = { wide: 164, narrow: 220 } as const

function edge(value: number): number {
  return value > 0 ? Math.max(value, SCREEN_EDGE_GUARD) : 0
}

export function computeRegions(
  deviceClass: DeviceClass,
  width: number,
  height: number,
  insets: SafeInsets,
): Regions {
  const left = edge(insets.left)
  const right = edge(insets.right)
  const top = edge(insets.top)
  const bottom = edge(insets.bottom)
  const innerX = left
  const innerW = width - left - right
  const innerH = height - top - bottom
  const hudH = HUD_HEIGHT[deviceClass]
  const hud: Rect = { x: innerX, y: top, width: innerW, height: hudH }
  if (deviceClass === 'wide') {
    const detail: Rect = {
      x: innerX,
      y: top + innerH - DETAIL_HEIGHT.wide,
      width: innerW,
      height: DETAIL_HEIGHT.wide,
    }
    const strip: Rect = {
      x: innerX,
      y: detail.y - STRIP_HEIGHT,
      width: Math.min(STRIP_WIDTH_WIDE, innerW - TRAY_WIDTH_WIDE),
      height: STRIP_HEIGHT,
    }
    const tray: Rect = {
      x: innerX + strip.width,
      y: strip.y,
      width: innerW - strip.width,
      height: STRIP_HEIGHT,
    }
    const town: Rect = { x: innerX, y: top + hudH, width: innerW, height: strip.y - (top + hudH) }
    return { hud, town, strip, tray, detail }
  }
  const strip: Rect = {
    x: innerX,
    y: top + innerH - STRIP_HEIGHT,
    width: innerW,
    height: STRIP_HEIGHT,
  }
  const town: Rect = { x: innerX, y: top + hudH, width: innerW, height: TOWN_HEIGHT.narrow }
  const tray: Rect = {
    x: innerX,
    y: town.y + town.height,
    width: innerW,
    height: strip.y - (town.y + town.height),
  }
  const detail: Rect = {
    x: innerX,
    y: strip.y - DETAIL_HEIGHT.narrow,
    width: innerW,
    height: DETAIL_HEIGHT.narrow,
  }
  return { hud, town, strip, tray, detail }
}
