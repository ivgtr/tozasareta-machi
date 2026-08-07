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
  controls: Rect
}

export const HUD_HEIGHT = { wide: 56, narrow: 52 } as const
export const DECK_HEIGHT = { wide: 128, narrow: 118 } as const
export const CONTROLS_HEIGHT = { wide: 128, narrow: 64 } as const
export const WIDE_CONTROLS_WIDTH = 360
export const WIDE_COMMAND_GAP = 8

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
    const commandY = top + innerH - DECK_HEIGHT.wide
    const controlsW = Math.min(WIDE_CONTROLS_WIDTH, Math.max(320, innerW * 0.3))
    const deckW = innerW - controlsW - WIDE_COMMAND_GAP
    const deck: Rect = {
      x: innerX,
      y: commandY,
      width: deckW,
      height: DECK_HEIGHT.wide,
    }
    const controls: Rect = {
      x: innerX + deckW + WIDE_COMMAND_GAP,
      y: commandY,
      width: controlsW,
      height: CONTROLS_HEIGHT.wide,
    }
    const town: Rect = {
      x: innerX,
      y: top + hudH,
      width: innerW,
      height: commandY - (top + hudH),
    }
    return { hud, town, deck, controls }
  }

  const controls: Rect = {
    x: innerX,
    y: top + innerH - CONTROLS_HEIGHT.narrow,
    width: innerW,
    height: CONTROLS_HEIGHT.narrow,
  }
  const deck: Rect = {
    x: innerX,
    y: controls.y - DECK_HEIGHT.narrow,
    width: innerW,
    height: DECK_HEIGHT.narrow,
  }
  const town: Rect = {
    x: innerX,
    y: top + hudH,
    width: innerW,
    height: deck.y - (top + hudH),
  }
  return { hud, town, deck, controls }
}
