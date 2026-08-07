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
  deck: Rect
  strip: Rect
}

export const HUD_HEIGHT = { wide: 48, narrow: 44 } as const
export const DECK_HEIGHT = { wide: 112, narrow: 118 } as const
export const STRIP_HEIGHT = 48

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
  const deckH = DECK_HEIGHT[deviceClass]

  const hud: Rect = { x: innerX, y: top, width: innerW, height: hudH }
  const strip: Rect = {
    x: innerX,
    y: top + innerH - STRIP_HEIGHT,
    width: innerW,
    height: STRIP_HEIGHT,
  }
  const deck: Rect = {
    x: innerX,
    y: strip.y - deckH,
    width: innerW,
    height: deckH,
  }
  const town: Rect = {
    x: innerX,
    y: top + hudH,
    width: innerW,
    height: deck.y - (top + hudH),
  }

  return { hud, town, deck, strip }
}
