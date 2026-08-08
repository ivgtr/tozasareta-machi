export type DeviceClass = 'wide' | 'narrow'

export const WIDE_MIN_WIDTH = 900

export const DESIGN_SIZES: Record<DeviceClass, { width: number; height: number }> = {
  wide: { width: 1280, height: 720 },
  narrow: { width: 480, height: 854 },
}

export function deviceClassOf(viewportWidth: number): DeviceClass {
  return viewportWidth >= WIDE_MIN_WIDTH ? 'wide' : 'narrow'
}

export function designSizeOf(deviceClass: DeviceClass): { width: number; height: number } {
  return DESIGN_SIZES[deviceClass]
}

export interface SafeInsets {
  top: number
  right: number
  bottom: number
  left: number
}

export interface CssBounds {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

export const NO_INSETS: SafeInsets = { top: 0, right: 0, bottom: 0, left: 0 }

export const SCREEN_EDGE_GUARD = 8

function guardEdge(value: number): number {
  if (value <= 0) return 0
  return Math.max(value, SCREEN_EDGE_GUARD)
}

export function guardSafeInsets(insets: SafeInsets): SafeInsets {
  return {
    top: guardEdge(insets.top),
    right: guardEdge(insets.right),
    bottom: guardEdge(insets.bottom),
    left: guardEdge(insets.left),
  }
}

export function readSafeInsets(): SafeInsets {
  if (typeof document === 'undefined' || typeof getComputedStyle === 'undefined') return NO_INSETS
  const probe = document.createElement('div')
  probe.style.position = 'fixed'
  probe.style.paddingTop = 'env(safe-area-inset-top, 0px)'
  probe.style.paddingRight = 'env(safe-area-inset-right, 0px)'
  probe.style.paddingBottom = 'env(safe-area-inset-bottom, 0px)'
  probe.style.paddingLeft = 'env(safe-area-inset-left, 0px)'
  document.body.appendChild(probe)
  const cs = getComputedStyle(probe)
  const insets: SafeInsets = {
    top: Number.parseFloat(cs.paddingTop) || 0,
    right: Number.parseFloat(cs.paddingRight) || 0,
    bottom: Number.parseFloat(cs.paddingBottom) || 0,
    left: Number.parseFloat(cs.paddingLeft) || 0,
  }
  document.body.removeChild(probe)
  return insets
}

export function toLogicalSafeInsets(
  insets: SafeInsets,
  viewportWidth: number,
  viewportHeight: number,
  canvas: CssBounds,
  logicalWidth: number,
  logicalHeight: number,
): SafeInsets {
  if (canvas.width <= 0 || canvas.height <= 0) return NO_INSETS
  const scaleX = logicalWidth / canvas.width
  const scaleY = logicalHeight / canvas.height
  const leftMargin = Math.max(0, canvas.left)
  const topMargin = Math.max(0, canvas.top)
  const rightMargin = Math.max(0, viewportWidth - canvas.right)
  const bottomMargin = Math.max(0, viewportHeight - canvas.bottom)
  return {
    left: Math.max(0, insets.left - leftMargin) * scaleX,
    right: Math.max(0, insets.right - rightMargin) * scaleX,
    top: Math.max(0, insets.top - topMargin) * scaleY,
    bottom: Math.max(0, insets.bottom - bottomMargin) * scaleY,
  }
}

export function logicalSafeInsetsForCanvas(
  canvas: HTMLCanvasElement,
  logicalWidth: number,
  logicalHeight: number,
): SafeInsets {
  return guardSafeInsets(
    toLogicalSafeInsets(
      readSafeInsets(),
      window.innerWidth,
      window.innerHeight,
      canvas.getBoundingClientRect(),
      logicalWidth,
      logicalHeight,
    ),
  )
}
