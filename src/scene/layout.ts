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

export const NO_INSETS: SafeInsets = { top: 0, right: 0, bottom: 0, left: 0 }

export const SCREEN_EDGE_GUARD = 8

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
