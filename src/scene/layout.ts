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
