export const COLORS = {
  night900: 0x0a0e24,
  night800: 0x131740,
  night700: 0x1c2258,
  night600: 0x252c6e,
  frameHi: 0xe8ecff,
  frameLo: 0x5a6190,
  ink: 0xe8ecff,
  inkDim: 0x9aa3cc,
  amber: 0xffc857,
  red: 0xff5f66,
  green: 0x5ee6a8,
  cyan: 0x6fd8ff,
  gold: 0xffd94a,
} as const

export type ColorToken = keyof typeof COLORS

export function colorCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

export const FONT_BODY = 'DotGothic16'
export const FONT_DISPLAY = '"Press Start 2P"'

export const PANEL = {
  border: 3,
  inset: 3,
  padding: 12,
  shadowX: 6,
  shadowY: 6,
  shadowAlpha: 0.45,
  shadowColor: 0x000000,
} as const

export const PANEL_CONTENT_INSET = PANEL.border + PANEL.inset + PANEL.padding

export const BUTTON = {
  border: 3,
  shadow: 4,
  shadowPressed: 2,
  pressShift: 2,
  disabledAlpha: 0.45,
  shadowAlpha: 0.45,
  shadowColor: 0x000000,
  trackingEm: 0.08,
} as const

export const GAUGE = {
  segments: 10,
  cellHeight: 14,
  cellBorder: 2,
  cellGap: 3,
  lowRatio: 0.25,
} as const

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
} as const

export const SCREEN_MARGIN = 16

export const TEXT_SIZE = {
  title: 32,
  dayCounterWide: 28,
  dayCounterNarrow: 20,
  heading: 20,
  bodyWide: 15,
  bodyNarrow: 13,
  labelWide: 12,
  labelNarrow: 11,
} as const
