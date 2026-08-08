import Phaser from 'phaser'
import { COLORS, FONT_BODY, TEXT_SIZE, colorCss } from '../tokens'

export interface PixelTextOptions {
  fontFamily?: string
  fontSize?: number
  color?: number
  align?: 'left' | 'center' | 'right'
  wordWrapWidth?: number
  advancedWrap?: boolean
  trackingEm?: number
  backgroundColor?: string
}

export function pixelText(
  scene: Phaser.Scene,
  text: string,
  options: PixelTextOptions = {},
): Phaser.GameObjects.Text {
  const fontSize = options.fontSize ?? TEXT_SIZE.bodyWide
  const view = scene.add.text(0, 0, text, {
    fontFamily: options.fontFamily ?? FONT_BODY,
    fontSize: `${fontSize}px`,
    color: colorCss(options.color ?? COLORS.ink),
    align: options.align ?? 'left',
    letterSpacing: options.trackingEm ? Math.round(fontSize * options.trackingEm) : 0,
    ...(options.wordWrapWidth !== undefined
      ? {
          wordWrap: {
            width: options.wordWrapWidth,
            useAdvancedWrap: options.advancedWrap ?? false,
          },
        }
      : {}),
    ...(options.backgroundColor !== undefined ? { backgroundColor: options.backgroundColor } : {}),
  })
  view.setResolution(Math.min(window.devicePixelRatio || 1, 2))
  return view
}
